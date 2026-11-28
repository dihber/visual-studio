import type { ClienteSync, ProdutoSync, StatusPedido, TipoEmbalagem } from '@dihber/shared';
import { db } from './index';
import { normalizar } from '../lib/texto';
import { calcularRascunho, type ItemRascunho } from '../lib/rascunho';

export interface ClienteLocal {
  id: string;
  codigo: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface ProdutoLocal {
  id: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  qtdPorCaixa: number;
  precoUnitario: number;
  estoque: number | null;
}

export type SituacaoLocal = 'NAO_ENVIADO' | 'ENVIADO';

export interface PedidoLocal {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteCodigo: string;
  observacao: string | null;
  valorTotal: number;
  criadoNoAppEm: string;
  situacao: SituacaoLocal;
  numero: number | null;
  status: StatusPedido | null;
  motivoReprovacao: string | null;
  motivoCancelamento: string | null;
  erroEnvio: string | null;
  enviadoEm: string | null;
}

export interface ItemLocal {
  id: string;
  pedidoId: string;
  produtoId: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  qtdPorCaixa: number;
  tipoEmbalagem: TipoEmbalagem;
  quantidade: number;
  qtdUnidades: number;
  precoUnitario: number;
  valorTotal: number;
}

const LIMITE_BUSCA = 60;

/** Monta busca por termos: todos os termos precisam aparecer (código, nome, CNPJ...). */
function filtroBusca(texto: string) {
  const termos = normalizar(texto).split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    where: termos.length ? 'WHERE ' + termos.map(() => 'busca LIKE ?').join(' AND ') : '',
    params: termos.map((t) => `%${t}%`),
  };
}

// ---------- clientes ----------
export function buscarClientes(texto: string): ClienteLocal[] {
  const f = filtroBusca(texto);
  return db.getAllSync<ClienteLocal>(
    `SELECT id, codigo, razaoSocial, nomeFantasia, cpfCnpj, telefone, cidade, uf FROM clientes ${f.where} ORDER BY razaoSocial LIMIT ${LIMITE_BUSCA}`,
    f.params,
  );
}

export function contarClientes(): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) n FROM clientes')?.n ?? 0;
}

/** Aplica o delta de clientes. Retorna quantos foram adicionados, alterados e removidos. */
export function aplicarClientes(lista: ClienteSync[]) {
  const r = { novos: 0, alterados: 0, removidos: 0 };
  if (!lista.length) return r;
  const existe = db.prepareSync('SELECT 1 FROM clientes WHERE id = ?');
  const upsert = db.prepareSync(
    `INSERT INTO clientes (id, codigo, razaoSocial, nomeFantasia, cpfCnpj, telefone, cidade, uf, busca)
     VALUES ($id, $codigo, $razaoSocial, $nomeFantasia, $cpfCnpj, $telefone, $cidade, $uf, $busca)
     ON CONFLICT(id) DO UPDATE SET codigo=excluded.codigo, razaoSocial=excluded.razaoSocial, nomeFantasia=excluded.nomeFantasia,
       cpfCnpj=excluded.cpfCnpj, telefone=excluded.telefone, cidade=excluded.cidade, uf=excluded.uf, busca=excluded.busca`,
  );
  const remover = db.prepareSync('DELETE FROM clientes WHERE id = ?');
  try {
    db.withTransactionSync(() => {
      for (const c of lista) {
        const ja = !!existe.executeSync([c.id]).getFirstSync();
        if (!c.ativo) {
          if (ja) {
            remover.executeSync([c.id]);
            r.removidos++;
          }
          continue;
        }
        upsert.executeSync({
          $id: c.id,
          $codigo: c.codigo,
          $razaoSocial: c.razaoSocial,
          $nomeFantasia: c.nomeFantasia,
          $cpfCnpj: c.cpfCnpj,
          $telefone: c.telefone,
          $cidade: c.cidade,
          $uf: c.uf,
          $busca: normalizar(
            [c.codigo, c.razaoSocial, c.nomeFantasia, c.cpfCnpj, c.cidade]
              .filter(Boolean)
              .join(' '),
          ),
        });
        ja ? r.alterados++ : r.novos++;
      }
    });
  } finally {
    existe.finalizeSync();
    upsert.finalizeSync();
    remover.finalizeSync();
  }
  return r;
}

// ---------- produtos ----------
export function buscarProdutos(texto: string): ProdutoLocal[] {
  const f = filtroBusca(texto);
  return db.getAllSync<ProdutoLocal>(
    `SELECT id, codigo, descricao, embalagem, qtdPorCaixa, precoUnitario, estoque FROM produtos ${f.where} ORDER BY descricao LIMIT ${LIMITE_BUSCA}`,
    f.params,
  );
}

export function contarProdutos(): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) n FROM produtos')?.n ?? 0;
}

export function aplicarProdutos(lista: ProdutoSync[]) {
  const r = { novos: 0, alterados: 0, removidos: 0 };
  if (!lista.length) return r;
  const existe = db.prepareSync('SELECT 1 FROM produtos WHERE id = ?');
  const upsert = db.prepareSync(
    `INSERT INTO produtos (id, codigo, descricao, embalagem, qtdPorCaixa, precoUnitario, estoque, busca)
     VALUES ($id, $codigo, $descricao, $embalagem, $qtdPorCaixa, $precoUnitario, $estoque, $busca)
     ON CONFLICT(id) DO UPDATE SET codigo=excluded.codigo, descricao=excluded.descricao, embalagem=excluded.embalagem,
       qtdPorCaixa=excluded.qtdPorCaixa, precoUnitario=excluded.precoUnitario, estoque=excluded.estoque, busca=excluded.busca`,
  );
  const remover = db.prepareSync('DELETE FROM produtos WHERE id = ?');
  try {
    db.withTransactionSync(() => {
      for (const p of lista) {
        const ja = !!existe.executeSync([p.id]).getFirstSync();
        if (!p.ativo) {
          if (ja) {
            remover.executeSync([p.id]);
            r.removidos++;
          }
          continue;
        }
        upsert.executeSync({
          $id: p.id,
          $codigo: p.codigo,
          $descricao: p.descricao,
          $embalagem: p.embalagem,
          $qtdPorCaixa: p.qtdPorCaixa,
          $precoUnitario: p.precoUnitario,
          $estoque: p.estoque,
          $busca: normalizar(`${p.codigo} ${p.descricao}`),
        });
        ja ? r.alterados++ : r.novos++;
      }
    });
  } finally {
    existe.finalizeSync();
    upsert.finalizeSync();
    remover.finalizeSync();
  }
  return r;
}

// ---------- pedidos ----------
export function listarPedidos(limite = 200): PedidoLocal[] {
  return db.getAllSync<PedidoLocal>(
    `SELECT * FROM pedidos ORDER BY CASE situacao WHEN 'NAO_ENVIADO' THEN 0 ELSE 1 END, criadoNoAppEm DESC LIMIT ?`,
    [limite],
  );
}

export function contarNaoEnviados(): number {
  return (
    db.getFirstSync<{ n: number }>(`SELECT COUNT(*) n FROM pedidos WHERE situacao = 'NAO_ENVIADO'`)
      ?.n ?? 0
  );
}

export function obterPedido(id: string): { pedido: PedidoLocal; itens: ItemLocal[] } | null {
  const pedido = db.getFirstSync<PedidoLocal>('SELECT * FROM pedidos WHERE id = ?', [id]);
  if (!pedido) return null;
  const itens = db.getAllSync<ItemLocal>(
    'SELECT * FROM pedido_itens WHERE pedidoId = ? ORDER BY rowid',
    [id],
  );
  return { pedido, itens };
}

export function pedidosNaoEnviados(): { pedido: PedidoLocal; itens: ItemLocal[] }[] {
  const lista = db.getAllSync<PedidoLocal>(
    `SELECT * FROM pedidos WHERE situacao = 'NAO_ENVIADO' ORDER BY criadoNoAppEm`,
  );
  return lista.map((pedido) => ({
    pedido,
    itens: db.getAllSync<ItemLocal>('SELECT * FROM pedido_itens WHERE pedidoId = ?', [pedido.id]),
  }));
}

export interface SalvarPedidoDados {
  id: string;
  cliente: ClienteLocal;
  itens: ItemRascunho[];
  observacao: string;
  criadoNoAppEm?: string;
  gerarId: () => string;
}

/** Salva (cria ou substitui) um pedido não enviado. */
export function salvarPedido(d: SalvarPedidoDados) {
  const { itens, total } = calcularRascunho(d.itens);
  const existente = db.getFirstSync<{ situacao: string; criadoNoAppEm: string }>(
    'SELECT situacao, criadoNoAppEm FROM pedidos WHERE id = ?',
    [d.id],
  );
  if (existente && existente.situacao !== 'NAO_ENVIADO')
    throw new Error('Pedido já enviado não pode ser alterado.');

  db.withTransactionSync(() => {
    db.runSync('DELETE FROM pedido_itens WHERE pedidoId = ?', [d.id]);
    db.runSync(
      `INSERT INTO pedidos (id, clienteId, clienteNome, clienteCodigo, observacao, valorTotal, criadoNoAppEm, situacao, erroEnvio)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'NAO_ENVIADO', NULL)
       ON CONFLICT(id) DO UPDATE SET clienteId=excluded.clienteId, clienteNome=excluded.clienteNome, clienteCodigo=excluded.clienteCodigo,
         observacao=excluded.observacao, valorTotal=excluded.valorTotal, erroEnvio=NULL`,
      [
        d.id,
        d.cliente.id,
        d.cliente.nomeFantasia || d.cliente.razaoSocial,
        d.cliente.codigo,
        d.observacao.trim() || null,
        total,
        existente?.criadoNoAppEm ?? d.criadoNoAppEm ?? new Date().toISOString(),
      ],
    );
    for (const i of itens) {
      db.runSync(
        `INSERT INTO pedido_itens (id, pedidoId, produtoId, codigo, descricao, embalagem, qtdPorCaixa, tipoEmbalagem, quantidade, qtdUnidades, precoUnitario, valorTotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.gerarId(),
          d.id,
          i.produto.id,
          i.produto.codigo,
          i.produto.descricao,
          i.produto.embalagem,
          i.produto.qtdPorCaixa,
          i.tipoEmbalagem,
          i.quantidade,
          i.qtdUnidades,
          i.produto.precoUnitario,
          i.valorTotal,
        ],
      );
    }
  });
}

export function excluirPedido(id: string) {
  const r = db.runSync(`DELETE FROM pedidos WHERE id = ? AND situacao = 'NAO_ENVIADO'`, [id]);
  db.runSync(
    'DELETE FROM pedido_itens WHERE pedidoId = ? AND NOT EXISTS (SELECT 1 FROM pedidos WHERE id = ?)',
    [id, id],
  );
  if (r.changes === 0) throw new Error('Pedido já enviado não pode ser excluído.');
}

export function marcarEnviado(id: string, numero: number) {
  db.runSync(
    `UPDATE pedidos SET situacao='ENVIADO', numero=?, status=COALESCE(status,'PENDENTE'), erroEnvio=NULL, enviadoEm=? WHERE id = ?`,
    [numero, new Date().toISOString(), id],
  );
}

export function marcarErroEnvio(id: string, erro: string) {
  db.runSync(`UPDATE pedidos SET erroEnvio=? WHERE id = ? AND situacao='NAO_ENVIADO'`, [erro, id]);
}

export function atualizarStatusPedidos(
  lista: {
    id: string;
    numero: number;
    status: StatusPedido;
    motivoReprovacao: string | null;
    /** Opcional: API antiga não envia. */
    motivoCancelamento?: string | null;
  }[],
) {
  let n = 0;
  db.withTransactionSync(() => {
    for (const s of lista) {
      const r = db.runSync(
        `UPDATE pedidos SET status=?, motivoReprovacao=?, motivoCancelamento=?, numero=?, situacao='ENVIADO', erroEnvio=NULL WHERE id = ?`,
        [s.status, s.motivoReprovacao, s.motivoCancelamento ?? null, s.numero, s.id],
      );
      n += r.changes;
    }
  });
  return n;
}
