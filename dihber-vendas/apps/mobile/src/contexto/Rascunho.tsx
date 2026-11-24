import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
import type { TipoEmbalagem } from '@dihber/shared';
import { obterPedido, salvarPedido, type ClienteLocal } from '../db/repositorio';
import {
  adicionarItem as add,
  alterarQuantidade as alterar,
  calcularRascunho,
  removerItem as remover,
  type ItemRascunho,
  type ProdutoResumo,
} from '../lib/rascunho';

interface RascunhoCtx {
  id: string;
  editando: boolean;
  cliente: ClienteLocal | null;
  itens: ItemRascunho[];
  observacao: string;
  calculo: ReturnType<typeof calcularRascunho>;
  novo: () => void;
  carregar: (pedidoId: string) => boolean;
  definirCliente: (c: ClienteLocal) => void;
  adicionar: (p: ProdutoResumo, tipo: TipoEmbalagem, qtd: number) => void;
  alterarQuantidade: (indice: number, qtd: number) => void;
  remover: (indice: number) => void;
  setObservacao: (s: string) => void;
  salvar: () => string;
}

const Ctx = createContext<RascunhoCtx | null>(null);

export function RascunhoProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => Crypto.randomUUID());
  const [editando, setEditando] = useState(false);
  const [cliente, setCliente] = useState<ClienteLocal | null>(null);
  const [itens, setItens] = useState<ItemRascunho[]>([]);
  const [observacao, setObservacao] = useState('');

  const novo = useCallback(() => {
    setId(Crypto.randomUUID()); // UUID gerado no app = idempotência no servidor
    setEditando(false);
    setCliente(null);
    setItens([]);
    setObservacao('');
  }, []);

  const carregar = useCallback((pedidoId: string) => {
    const r = obterPedido(pedidoId);
    if (!r || r.pedido.situacao !== 'NAO_ENVIADO') return false;
    setId(pedidoId);
    setEditando(true);
    setCliente({
      id: r.pedido.clienteId,
      codigo: r.pedido.clienteCodigo,
      razaoSocial: r.pedido.clienteNome,
      nomeFantasia: null,
      cpfCnpj: '',
      telefone: null,
      cidade: null,
      uf: null,
    });
    setItens(
      r.itens.map((i) => ({
        produto: {
          id: i.produtoId,
          codigo: i.codigo,
          descricao: i.descricao,
          embalagem: i.embalagem,
          qtdPorCaixa: i.qtdPorCaixa,
          precoUnitario: i.precoUnitario,
        },
        tipoEmbalagem: i.tipoEmbalagem,
        quantidade: i.quantidade,
      })),
    );
    setObservacao(r.pedido.observacao ?? '');
    return true;
  }, []);

  const calculo = useMemo(() => calcularRascunho(itens), [itens]);

  const valor: RascunhoCtx = {
    id,
    editando,
    cliente,
    itens,
    observacao,
    calculo,
    novo,
    carregar,
    definirCliente: setCliente,
    adicionar: (produto, tipoEmbalagem, quantidade) =>
      setItens((s) => add(s, { produto, tipoEmbalagem, quantidade })),
    alterarQuantidade: (i, q) => setItens((s) => alterar(s, i, q)),
    remover: (i) => setItens((s) => remover(s, i)),
    setObservacao,
    salvar: () => {
      if (!cliente) throw new Error('Selecione o cliente.');
      if (itens.length === 0) throw new Error('Adicione ao menos um produto.');
      salvarPedido({ id, cliente, itens, observacao, gerarId: Crypto.randomUUID });
      return id;
    },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useRascunho() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRascunho fora do RascunhoProvider');
  return c;
}
