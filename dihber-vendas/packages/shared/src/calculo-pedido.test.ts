import { describe, expect, it } from 'vitest';
import { calcularItem, calcularTotalPedido, textoConversao } from './calculo-pedido';
import { validarCnpj, validarCpf } from './cpf-cnpj';

describe('cálculo do item', () => {
  it('CX converte para unidades', () => {
    expect(calcularItem({ tipoEmbalagem: 'CX', quantidade: 2, qtdPorCaixa: 6, precoUnitario: 10.5 })).toEqual({
      qtdUnidades: 12,
      valorTotal: 126,
    });
  });
  it('UN mantém a quantidade', () => {
    expect(calcularItem({ tipoEmbalagem: 'UN', quantidade: 3, qtdPorCaixa: 12, precoUnitario: 0.1 })).toEqual({
      qtdUnidades: 3,
      valorTotal: 0.3,
    });
  });
  it('arredonda centavos', () => {
    expect(calcularItem({ tipoEmbalagem: 'UN', quantidade: 1.333, qtdPorCaixa: 1, precoUnitario: 2.99 }).valorTotal).toBe(3.99);
  });
  it('soma total do pedido sem erro de ponto flutuante', () => {
    expect(calcularTotalPedido([{ valorTotal: 0.1 }, { valorTotal: 0.2 }])).toBe(0.3);
  });
  it('texto de conversão', () => {
    expect(textoConversao('CX', 2, 6)).toBe('2 CX = 12 UN');
  });
});

describe('CPF/CNPJ', () => {
  it('valida CPF', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf('111.111.111-11')).toBe(false);
  });
  it('valida CNPJ', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
    expect(validarCnpj('11.222.333/0001-82')).toBe(false);
  });
});
