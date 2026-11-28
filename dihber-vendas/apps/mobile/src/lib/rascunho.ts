import { calcularItem, calcularTotalPedido, type TipoEmbalagem } from '@dihber/shared';

export interface ProdutoResumo {
  id: string;
  codigo: string;
  descricao: string;
  embalagem: string;
  qtdPorCaixa: number;
  precoUnitario: number;
}

export interface ItemRascunho {
  produto: ProdutoResumo;
  tipoEmbalagem: TipoEmbalagem;
  quantidade: number;
}

export interface ItemCalculadoRascunho extends ItemRascunho {
  qtdUnidades: number;
  valorTotal: number;
}

/**
 * Adiciona item ao pedido. Mesmo produto com o mesmo tipo de embalagem é somado
 * ao item existente (regra 8.4 da especificação).
 */
export function adicionarItem(itens: ItemRascunho[], novo: ItemRascunho): ItemRascunho[] {
  if (!(novo.quantidade > 0)) return itens;
  const i = itens.findIndex(
    (x) => x.produto.id === novo.produto.id && x.tipoEmbalagem === novo.tipoEmbalagem,
  );
  if (i === -1) return [...itens, novo];
  const copia = [...itens];
  copia[i] = {
    ...copia[i],
    quantidade: Math.round((copia[i].quantidade + novo.quantidade) * 1000) / 1000,
  };
  return copia;
}

export function alterarQuantidade(
  itens: ItemRascunho[],
  indice: number,
  quantidade: number,
): ItemRascunho[] {
  if (!(quantidade > 0)) return removerItem(itens, indice);
  return itens.map((x, i) => (i === indice ? { ...x, quantidade } : x));
}

export function removerItem(itens: ItemRascunho[], indice: number): ItemRascunho[] {
  return itens.filter((_, i) => i !== indice);
}

export function calcularRascunho(itens: ItemRascunho[]) {
  const calculados: ItemCalculadoRascunho[] = itens.map((i) => ({
    ...i,
    ...calcularItem({
      tipoEmbalagem: i.tipoEmbalagem,
      quantidade: i.quantidade,
      qtdPorCaixa: i.produto.qtdPorCaixa,
      precoUnitario: i.produto.precoUnitario,
    }),
  }));
  return { itens: calculados, total: calcularTotalPedido(calculados) };
}

/** Quantidade já no pedido para um produto/tipo (exibida no cartão do produto). */
export function quantidadeNoPedido(
  itens: ItemRascunho[],
  produtoId: string,
  tipo: TipoEmbalagem,
): number {
  return itens.find((x) => x.produto.id === produtoId && x.tipoEmbalagem === tipo)?.quantidade ?? 0;
}

// ---------- forma de pagamento ----------
export interface PagamentoEscolhido {
  forma: 'PIX' | 'BOLETO';
  prazoId: string | null;
  prazoDescricao: string | null;
}

export interface OpcaoPagamento extends PagamentoEscolhido {
  chave: string;
  texto: string;
}

/** PIX sempre; boleto só nos prazos cadastrados para o cliente. */
export function opcoesPagamento(prazos: { id: string; descricao: string }[]): OpcaoPagamento[] {
  return [
    { chave: 'PIX', forma: 'PIX', prazoId: null, prazoDescricao: null, texto: 'PIX' },
    ...prazos.map((p) => ({
      chave: p.id,
      forma: 'BOLETO' as const,
      prazoId: p.id,
      prazoDescricao: p.descricao,
      texto: `Boleto ${p.descricao}`,
    })),
  ];
}

/** Mantém a escolha só se ela ainda for permitida para o cliente (ex.: ao trocar de cliente). */
export function pagamentoValido(
  escolhido: PagamentoEscolhido | null,
  prazos: { id: string; descricao: string }[],
): PagamentoEscolhido | null {
  if (!escolhido) return null;
  if (escolhido.forma === 'PIX') return escolhido;
  const prazo = prazos.find((p) => p.id === escolhido.prazoId);
  return prazo ? { ...escolhido, prazoDescricao: prazo.descricao } : null;
}

// ---------- estoque ----------
/** Quantidade total em UN de um produto no rascunho (somando CX e UN). */
export function unidadesNoRascunho(itens: ItemRascunho[], produtoId: string): number {
  const mil = itens
    .filter((i) => i.produto.id === produtoId)
    .reduce(
      (t, i) =>
        t +
        Math.round(i.quantidade * 1000) * (i.tipoEmbalagem === 'CX' ? i.produto.qtdPorCaixa : 1),
      0,
    );
  return mil / 1000;
}

/** Mensagem de bloqueio quando o rascunho passa do saldo (null = está dentro do saldo). */
export function erroEstoque(
  itens: ItemRascunho[],
  produto: { id: string; codigo: string; descricao: string },
  saldo: number | null,
): string | null {
  if (saldo === null) return null;
  const pedido = unidadesNoRascunho(itens, produto.id);
  if (pedido <= saldo + 1e-9) return null;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return `Estoque insuficiente para ${produto.codigo} - ${produto.descricao}: disponível ${fmt(Math.max(0, saldo))} UN, no pedido ${fmt(pedido)} UN.`;
}
