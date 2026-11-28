import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
import type { TipoEmbalagem } from '@dihber/shared';
import {
  obterCliente,
  obterPedido,
  precoProduto,
  salvarPedido,
  type ClienteLocal,
} from '../db/repositorio';
import {
  adicionarItem as add,
  alterarQuantidade as alterar,
  calcularRascunho,
  pagamentoValido,
  removerItem as remover,
  type PagamentoEscolhido,
  type ItemRascunho,
  type ProdutoResumo,
} from '../lib/rascunho';

interface RascunhoCtx {
  id: string;
  editando: boolean;
  cliente: ClienteLocal | null;
  itens: ItemRascunho[];
  observacao: string;
  pagamento: PagamentoEscolhido | null;
  calculo: ReturnType<typeof calcularRascunho>;
  novo: () => void;
  carregar: (pedidoId: string) => boolean;
  definirCliente: (c: ClienteLocal) => void;
  adicionar: (p: ProdutoResumo, tipo: TipoEmbalagem, qtd: number) => void;
  alterarQuantidade: (indice: number, qtd: number) => void;
  remover: (indice: number) => void;
  setObservacao: (s: string) => void;
  setPagamento: (p: PagamentoEscolhido | null) => void;
  salvar: () => string;
}

const Ctx = createContext<RascunhoCtx | null>(null);

export function RascunhoProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => Crypto.randomUUID());
  const [editando, setEditando] = useState(false);
  const [cliente, setCliente] = useState<ClienteLocal | null>(null);
  const [itens, setItens] = useState<ItemRascunho[]>([]);
  const [observacao, setObservacao] = useState('');
  const [pagamento, setPagamento] = useState<PagamentoEscolhido | null>(null);

  /** Atualiza os preços dos itens para a tabela do cliente. */
  const reprecificar = (lista: ItemRascunho[], c: ClienteLocal) =>
    lista.map((i) => {
      const preco = precoProduto(i.produto.id, c.tabelaPrecoId);
      return preco === null ? i : { ...i, produto: { ...i.produto, precoUnitario: preco } };
    });

  const novo = useCallback(() => {
    setId(Crypto.randomUUID()); // UUID gerado no app = idempotência no servidor
    setEditando(false);
    setCliente(null);
    setItens([]);
    setObservacao('');
    setPagamento(null);
  }, []);

  const carregar = useCallback((pedidoId: string) => {
    const r = obterPedido(pedidoId);
    if (!r || r.pedido.situacao !== 'NAO_ENVIADO') return false;
    setId(pedidoId);
    setEditando(true);
    // cliente atual do celular (com tabela e prazos); se saiu da carteira, usa o que o pedido guardou
    const c: ClienteLocal = obterCliente(r.pedido.clienteId) ?? {
      id: r.pedido.clienteId,
      codigo: r.pedido.clienteCodigo,
      razaoSocial: r.pedido.clienteNome,
      nomeFantasia: null,
      cpfCnpj: '',
      telefone: null,
      cidade: null,
      uf: null,
      tabelaPrecoId: null,
      prazos: [],
    };
    setCliente(c);
    setPagamento(
      pagamentoValido(
        r.pedido.formaPagamento
          ? {
              forma: r.pedido.formaPagamento,
              prazoId: r.pedido.prazoId,
              prazoDescricao: r.pedido.prazoDescricao,
            }
          : null,
        c.prazos,
      ),
    );
    setItens(
      reprecificar(
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
        c,
      ),
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
    pagamento,
    calculo,
    novo,
    carregar,
    definirCliente: (c) => {
      setCliente(c);
      // cliente novo pode ter outra tabela de preço e outros prazos
      setItens((s) => reprecificar(s, c));
      setPagamento((p) => pagamentoValido(p, c.prazos));
    },
    adicionar: (produto, tipoEmbalagem, quantidade) =>
      setItens((s) => add(s, { produto, tipoEmbalagem, quantidade })),
    alterarQuantidade: (i, q) => setItens((s) => alterar(s, i, q)),
    remover: (i) => setItens((s) => remover(s, i)),
    setObservacao,
    setPagamento,
    salvar: () => {
      if (!cliente) throw new Error('Selecione o cliente.');
      if (itens.length === 0) throw new Error('Adicione ao menos um produto.');
      if (!pagamento) throw new Error('Selecione a forma de pagamento.');
      salvarPedido({ id, cliente, itens, observacao, pagamento, gerarId: Crypto.randomUUID });
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
