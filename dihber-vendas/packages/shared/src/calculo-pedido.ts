import type { TipoEmbalagem } from './enums';

/**
 * Regras de cálculo do item (seção 4.3 da especificação).
 * Os cálculos são feitos em inteiros (milésimos de unidade e centavos)
 * para evitar erros de ponto flutuante.
 */

export interface ItemCalculoEntrada {
  tipoEmbalagem: TipoEmbalagem;
  quantidade: number;
  qtdPorCaixa: number;
  precoUnitario: number; // preço da UN, em reais
}

export interface ItemCalculado {
  qtdUnidades: number;
  valorTotal: number;
}

const arred = (valor: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

export function calcularQtdUnidades(
  tipoEmbalagem: TipoEmbalagem,
  quantidade: number,
  qtdPorCaixa: number,
): number {
  const qtdMil = Math.round(quantidade * 1000);
  const unidadesMil = tipoEmbalagem === 'CX' ? qtdMil * qtdPorCaixa : qtdMil;
  return unidadesMil / 1000;
}

export function calcularItem(item: ItemCalculoEntrada): ItemCalculado {
  const qtdUnidades = calcularQtdUnidades(item.tipoEmbalagem, item.quantidade, item.qtdPorCaixa);
  const unidadesMil = Math.round(qtdUnidades * 1000);
  const precoCent = Math.round(item.precoUnitario * 100);
  const totalCent = Math.round((unidadesMil * precoCent) / 1000);
  return { qtdUnidades, valorTotal: totalCent / 100 };
}

export function calcularTotalPedido(itens: { valorTotal: number }[]): number {
  const cent = itens.reduce((s, i) => s + Math.round(i.valorTotal * 100), 0);
  return cent / 100;
}

/** Texto de conversão exibido no app, ex.: "2 CX = 12 UN". */
export function textoConversao(
  tipoEmbalagem: TipoEmbalagem,
  quantidade: number,
  qtdPorCaixa: number,
): string {
  const un = calcularQtdUnidades(tipoEmbalagem, quantidade, qtdPorCaixa);
  if (tipoEmbalagem === 'UN') return `${formatarNumero(quantidade)} UN`;
  return `${formatarNumero(quantidade)} CX = ${formatarNumero(un)} UN`;
}

export { arred };

function formatarNumero(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** Comissão do item: valor vendido × % (arredondado em centavos). Ex.: R$ 100,00 × 5% = R$ 5,00. */
export function calcularComissao(valorVendido: number, percentual: number): number {
  const baseCent = Math.round(valorVendido * 100);
  const pctCentesimos = Math.round(percentual * 100);
  return Math.round((baseCent * pctCentesimos) / 10000) / 100;
}
