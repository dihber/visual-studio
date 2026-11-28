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
