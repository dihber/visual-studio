import type { SyncDadosResposta, SyncPedidosResposta } from '@dihber/shared';
import { api } from '../api/cliente';
import { dadosDispositivo } from '../api/sessao';
import { gravarMeta, lerMeta } from '../db';
import {
  aplicarClientes,
  aplicarProdutos,
  aplicarTabelasPreco,
  atualizarStatusPedidos,
  marcarEnviado,
  marcarErroEnvio,
  pedidosNaoEnviados,
} from '../db/repositorio';

export type EstadoEtapa = 'aguardando' | 'executando' | 'ok' | 'erro';
export interface Etapa {
  chave: 'enviar' | 'clientes' | 'produtos' | 'status';
  texto: string;
  estado: EstadoEtapa;
}

export interface ResultadoSync {
  enviados: number;
  rejeitados: { id: string | null; erro: string }[];
  clientes: { novos: number; alterados: number; removidos: number };
  produtos: { novos: number; alterados: number; removidos: number };
  statusAtualizados: number;
}

const LOTE = 50;
let emAndamento: Promise<ResultadoSync> | null = null;

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
function resumoDelta(d: { novos: number; alterados: number; removidos: number }) {
  const partes = [];
  if (d.novos) partes.push(plural(d.novos, 'novo', 'novos'));
  if (d.alterados) partes.push(plural(d.alterados, 'alterado', 'alterados'));
  if (d.removidos) partes.push(plural(d.removidos, 'removido', 'removidos'));
  return partes.length ? partes.join(', ') : 'sem alterações';
}

/**
 * Sincronização completa (seção 5.1):
 * 1. ENVIAR pedidos não enviados  2. RECEBER cadastros (delta)
 * 3. RECEBER status dos pedidos   4. Gravar último sync
 * Nada é apagado em caso de falha: basta tentar novamente.
 */
export function sincronizar(aoAtualizar: (etapas: Etapa[]) => void): Promise<ResultadoSync> {
  emAndamento ??= executar(aoAtualizar).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function executar(aoAtualizar: (etapas: Etapa[]) => void): Promise<ResultadoSync> {
  const pendentes = pedidosNaoEnviados();
  const etapas: Etapa[] = [
    {
      chave: 'enviar',
      texto: `Enviando ${plural(pendentes.length, 'pedido', 'pedidos')}…`,
      estado: 'aguardando',
    },
    { chave: 'clientes', texto: 'Recebendo clientes…', estado: 'aguardando' },
    { chave: 'produtos', texto: 'Recebendo produtos…', estado: 'aguardando' },
    { chave: 'status', texto: 'Atualizando status dos pedidos…', estado: 'aguardando' },
  ];
  const atualizar = (chave: Etapa['chave'], estado: EstadoEtapa, texto?: string) => {
    const e = etapas.find((x) => x.chave === chave)!;
    e.estado = estado;
    if (texto) e.texto = texto;
    aoAtualizar(etapas.map((x) => ({ ...x })));
  };
  let atual: Etapa['chave'] = 'enviar';

  try {
    const dispositivo = await dadosDispositivo();
    const resultado: ResultadoSync = {
      enviados: 0,
      rejeitados: [],
      clientes: { novos: 0, alterados: 0, removidos: 0 },
      produtos: { novos: 0, alterados: 0, removidos: 0 },
      statusAtualizados: 0,
    };

    // 1. ENVIAR
    atualizar('enviar', 'executando');
    for (let i = 0; i < pendentes.length; i += LOTE) {
      const lote = pendentes.slice(i, i + LOTE).map(({ pedido, itens }) => ({
        id: pedido.id,
        clienteId: pedido.clienteId,
        observacao: pedido.observacao,
        criadoNoAppEm: pedido.criadoNoAppEm,
        valorTotal: pedido.valorTotal,
        formaPagamento: pedido.formaPagamento ?? undefined,
        prazoPagamentoId: pedido.formaPagamento === 'BOLETO' ? pedido.prazoId : undefined,
        itens: itens.map((it) => ({
          produtoId: it.produtoId,
          tipoEmbalagem: it.tipoEmbalagem,
          quantidade: it.quantidade,
        })),
      }));
      const r = await api<SyncPedidosResposta>('/sync/pedidos', {
        method: 'POST',
        body: JSON.stringify({ dispositivo, pedidos: lote }),
      });
      for (const a of r.aceitos) marcarEnviado(a.id, a.numero);
      for (const x of r.rejeitados) if (x.id) marcarErroEnvio(x.id, x.erro);
      resultado.enviados += r.aceitos.length;
      resultado.rejeitados.push(...r.rejeitados);
    }
    atualizar(
      'enviar',
      resultado.rejeitados.length ? 'erro' : 'ok',
      pendentes.length === 0
        ? 'Nenhum pedido para enviar'
        : `${plural(resultado.enviados, 'pedido enviado', 'pedidos enviados')}` +
            (resultado.rejeitados.length
              ? ` · ${plural(resultado.rejeitados.length, 'recusado', 'recusados')}`
              : ''),
    );

    // 2/3. RECEBER
    atual = 'clientes';
    atualizar('clientes', 'executando');
    const desde = lerMeta('desde');
    const q = new URLSearchParams({ deviceId: dispositivo.deviceId, ...(desde ? { desde } : {}) });
    const dados = await api<SyncDadosResposta>(`/sync/dados?${q.toString()}`);

    // sem "desde" é carga completa: o que não veio sai do celular (ex.: fora da carteira)
    const completa = !desde;
    resultado.clientes = aplicarClientes(dados.clientes, dados.clientesRemovidos ?? [], completa);
    atualizar('clientes', 'ok', `Clientes: ${resumoDelta(resultado.clientes)}`);
    atual = 'produtos';
    resultado.produtos = aplicarProdutos(dados.produtos, completa);
    aplicarTabelasPreco(dados.tabelasPreco ?? [], completa);
    atualizar('produtos', 'ok', `Produtos: ${resumoDelta(resultado.produtos)}`);
    atual = 'status';
    resultado.statusAtualizados = atualizarStatusPedidos(dados.statusPedidos);
    atualizar('status', 'ok', 'Status de pedidos atualizado');

    // 4. servidorAgora vira o próximo "desde" (não depende do relógio do celular)
    gravarMeta('desde', dados.servidorAgora);
    gravarMeta('ultimoSync', new Date().toISOString());
    return resultado;
  } catch (e) {
    atualizar(atual, 'erro');
    throw e;
  }
}
