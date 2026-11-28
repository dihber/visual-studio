import { describe, expect, it } from 'vitest';
import { calcularItem, calcularTotalPedido, textoConversao } from './calculo-pedido';
import { validarCnpj, validarCpf } from './cpf-cnpj';

describe('cálculo do item', () => {
  it('CX converte para unidades', () => {
    expect(
      calcularItem({ tipoEmbalagem: 'CX', quantidade: 2, qtdPorCaixa: 6, precoUnitario: 10.5 }),
    ).toEqual({
      qtdUnidades: 12,
      valorTotal: 126,
    });
  });
  it('UN mantém a quantidade', () => {
    expect(
      calcularItem({ tipoEmbalagem: 'UN', quantidade: 3, qtdPorCaixa: 12, precoUnitario: 0.1 }),
    ).toEqual({
      qtdUnidades: 3,
      valorTotal: 0.3,
    });
  });
  it('arredonda centavos', () => {
    expect(
      calcularItem({ tipoEmbalagem: 'UN', quantidade: 1.333, qtdPorCaixa: 1, precoUnitario: 2.99 })
        .valorTotal,
    ).toBe(3.99);
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

import { produtoSchema } from './index';
describe('mensagens em português', () => {
  it('campos obrigatórios e números', () => {
    const r = produtoSchema.safeParse({ codigo: 'X' });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain('Campo obrigatório');
    expect(msgs.join()).not.toMatch(/Required|Expected/);
  });
});

import { formatarSistema } from './formatacao';
describe('formatarSistema', () => {
  it('converte o fingerprint do Android', () => {
    expect(
      formatarSistema(
        'samsung/beyond0ltexx/beyond0:12/SP1A.210812.016/G970FXXSGHWC1:user/release-keys 12',
      ),
    ).toBe('Android 12');
  });
  it('mantém valores já legíveis', () => {
    expect(formatarSistema('Android 14')).toBe('Android 14');
    expect(formatarSistema('iOS 18.1')).toBe('iOS 18.1');
    expect(formatarSistema(null)).toBeNull();
  });
});

import { calcularComissao, competenciaBrasilia } from './index';
describe('comissão e competência', () => {
  it('comissão = valor vendido × %', () => {
    expect(calcularComissao(10, 5)).toBe(0.5);
    expect(calcularComissao(100, 5)).toBe(5);
    expect(calcularComissao(33.33, 2.5)).toBe(0.83);
    expect(calcularComissao(50, 0)).toBe(0);
  });
  it('mês no horário de Brasília', () => {
    expect(competenciaBrasilia('2026-12-01T01:00:00Z')).toBe('2026-11'); // 30/11 22h em Brasília
    expect(competenciaBrasilia('2026-12-01T03:00:00Z')).toBe('2026-12');
  });
});
