import { describe, expect, it } from 'vitest';
import {
  adicionarItem,
  alterarQuantidade,
  calcularRascunho,
  removerItem,
  type ProdutoResumo,
} from './rascunho';
import { lerNumero, normalizar } from './texto';

const arroz: ProdutoResumo = {
  id: 'a',
  codigo: '001',
  descricao: 'ARROZ',
  embalagem: 'CX C/ 6 UN',
  qtdPorCaixa: 6,
  precoUnitario: 10,
};

describe('rascunho do pedido', () => {
  it('soma o mesmo produto com o mesmo tipo', () => {
    let itens = adicionarItem([], { produto: arroz, tipoEmbalagem: 'CX', quantidade: 2 });
    itens = adicionarItem(itens, { produto: arroz, tipoEmbalagem: 'CX', quantidade: 1 });
    expect(itens).toHaveLength(1);
    expect(itens[0].quantidade).toBe(3);
  });
  it('tipos diferentes viram itens diferentes', () => {
    let itens = adicionarItem([], { produto: arroz, tipoEmbalagem: 'CX', quantidade: 2 });
    itens = adicionarItem(itens, { produto: arroz, tipoEmbalagem: 'UN', quantidade: 5 });
    expect(itens).toHaveLength(2);
    const r = calcularRascunho(itens);
    expect(r.itens[0].qtdUnidades).toBe(12);
    expect(r.total).toBe(170);
  });
  it('ignora quantidade zero e remove ao zerar', () => {
    expect(adicionarItem([], { produto: arroz, tipoEmbalagem: 'UN', quantidade: 0 })).toHaveLength(
      0,
    );
    const itens = adicionarItem([], { produto: arroz, tipoEmbalagem: 'UN', quantidade: 1 });
    expect(alterarQuantidade(itens, 0, 0)).toHaveLength(0);
    expect(removerItem(itens, 0)).toHaveLength(0);
  });
  it('helpers de texto', () => {
    expect(normalizar('  Feijão AÇÚCAR ')).toBe('feijao acucar');
    expect(lerNumero('1,5')).toBe(1.5);
    expect(lerNumero('')).toBeNaN();
  });
});

import { opcoesPagamento, pagamentoValido } from './rascunho';
describe('forma de pagamento', () => {
  const prazos = [
    { id: 'p30', descricao: '30 dias' },
    { id: 'p60', descricao: '30/60 dias' },
  ];
  it('PIX sempre; boleto só com os prazos do cliente', () => {
    expect(opcoesPagamento([]).map((o) => o.texto)).toEqual(['PIX']);
    expect(opcoesPagamento(prazos).map((o) => o.texto)).toEqual([
      'PIX',
      'Boleto 30 dias',
      'Boleto 30/60 dias',
    ]);
  });
  it('ao trocar de cliente, boleto com prazo não permitido é desfeito', () => {
    const boleto = { forma: 'BOLETO' as const, prazoId: 'p60', prazoDescricao: '30/60 dias' };
    expect(pagamentoValido(boleto, prazos)).toEqual(boleto);
    expect(pagamentoValido(boleto, [prazos[0]])).toBeNull();
    expect(
      pagamentoValido({ forma: 'PIX', prazoId: null, prazoDescricao: null }, []),
    ).not.toBeNull();
  });
});

import { erroEstoque, unidadesNoRascunho } from './rascunho';
describe('estoque no rascunho', () => {
  const cafe = {
    id: 'c',
    codigo: '121',
    descricao: 'CAFÉ',
    embalagem: 'CX C/ 20 UN',
    qtdPorCaixa: 20,
    precoUnitario: 17.9,
  };
  const itens = [
    { produto: cafe, tipoEmbalagem: 'CX' as const, quantidade: 2 },
    { produto: cafe, tipoEmbalagem: 'UN' as const, quantidade: 5 },
  ];
  it('soma CX e UN em unidades', () => {
    expect(unidadesNoRascunho(itens, 'c')).toBe(45);
  });
  it('bloqueia acima do saldo; sem controle não bloqueia', () => {
    expect(erroEstoque(itens, cafe, 45)).toBeNull();
    expect(erroEstoque(itens, cafe, 44)).toBe(
      'Estoque insuficiente para 121 - CAFÉ: disponível 44 UN, no pedido 45 UN.',
    );
    expect(erroEstoque(itens, cafe, null)).toBeNull();
  });
});
