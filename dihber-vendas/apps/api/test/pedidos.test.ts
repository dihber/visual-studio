import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, dispositivo, montarCenario, novoPedido, type Cenario } from './helpers';

let c: Cenario;
const ids: Record<string, string> = {};

beforeAll(async () => {
  c = await montarCenario();
  const enviar = async (token: string, nome: string, qtd: number) => {
    const p = novoPedido(c.cliente.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: qtd },
    ]);
    ids[nome] = p.id;
    await c.app.inject({
      method: 'POST',
      url: '/api/v1/sync/pedidos',
      headers: auth(token),
      payload: { dispositivo, pedidos: [p] },
    });
  };
  await enviar(c.tokens.vendedor1, 'v1', 10); // 105,00
  await enviar(c.tokens.vendedor2, 'v2', 20); // 210,00
  await enviar(c.tokens.vendedorB, 'vb', 1); // outra equipe
});
afterAll(async () => {
  await c.app.close();
});

const get = (url: string, token: string) =>
  c.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: auth(token) });
const post = (url: string, token: string, payload?: object) =>
  c.app.inject({ method: 'POST', url: `/api/v1${url}`, headers: auth(token), payload });

describe('visibilidade de pedidos', () => {
  it('admin vê todos', async () => {
    expect((await get('/pedidos', c.tokens.admin)).json().total).toBe(3);
  });
  it('supervisor vê só a equipe', async () => {
    const r = (await get('/pedidos', c.tokens.supervisor)).json();
    expect(r.total).toBe(2);
    expect((await get(`/pedidos/${ids.vb}`, c.tokens.supervisor)).statusCode).toBe(404);
  });
  it('vendedor vê só os próprios', async () => {
    const r = (await get('/pedidos', c.tokens.vendedor1)).json();
    expect(r.dados.map((p: { id: string }) => p.id)).toEqual([ids.v1]);
  });
  it('filtros por status e vendedor', async () => {
    const r = (
      await get(`/pedidos?vendedorId=${c.vend2.id}&status=PENDENTE`, c.tokens.admin)
    ).json();
    expect(r.total).toBe(1);
    expect(r.dados[0].dispositivo.modelo).toBe('Samsung SM-A155M');
    expect(r.dados[0]._count.itens).toBe(1);
  });
});

describe('aprovar / reprovar', () => {
  it('supervisor não avalia pedido de outra equipe', async () => {
    expect((await post(`/pedidos/${ids.vb}/aprovar`, c.tokens.supervisor)).statusCode).toBe(404);
  });
  it('vendedor não aprova', async () => {
    expect((await post(`/pedidos/${ids.v1}/aprovar`, c.tokens.vendedor1)).statusCode).toBe(403);
  });
  it('reprovar exige motivo', async () => {
    expect((await post(`/pedidos/${ids.v2}/reprovar`, c.tokens.admin, {})).statusCode).toBe(400);
  });
  it('aprova e registra auditoria; não reavalia', async () => {
    const r = await post(`/pedidos/${ids.v1}/aprovar`, c.tokens.supervisor);
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('APROVADO');
    const det = (await get(`/pedidos/${ids.v1}`, c.tokens.admin)).json();
    expect(det.avaliadoPor.nome).toBe('Sup A');
    expect(det.avaliadoEm).toBeTruthy();
    expect(det.itens[0].produto.codigo).toBe('P1');
    expect(
      (await post(`/pedidos/${ids.v1}/reprovar`, c.tokens.admin, { motivo: 'teste' })).statusCode,
    ).toBe(409);
  });
});

describe('resumo, vendas da equipe e exportação', () => {
  it('resumo', async () => {
    const r = (await get('/pedidos/resumo', c.tokens.supervisor)).json();
    expect(r).toMatchObject({ pendentes: 1, aprovados: 1, reprovados: 0, totalVendido: 315 });
  });
  it('vendas por vendedor da equipe', async () => {
    const r = (await get('/pedidos/vendas-equipe', c.tokens.supervisor)).json();
    expect(
      r.map((x: { vendedor: { codigo: string }; total: number }) => [x.vendedor.codigo, x.total]),
    ).toEqual([
      ['V2', 210],
      ['V1', 105],
    ]);
  });
  it('exporta CSV respeitando visibilidade', async () => {
    const r = await get('/pedidos/exportar', c.tokens.supervisor);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    const linhas = r.body.trim().split('\r\n');
    expect(linhas).toHaveLength(3); // cabeçalho + 2 itens
    expect(linhas[0]).toContain('Número;Data;Status');
  });
});

describe('cancelar', () => {
  it('vendedor não cancela', async () => {
    const r = await post(`/pedidos/${ids.v2}/cancelar`, c.tokens.vendedor2, { motivo: 'teste' });
    expect(r.statusCode).toBe(403);
  });
  it('supervisor não cancela pedido de outra equipe', async () => {
    const r = await post(`/pedidos/${ids.vb}/cancelar`, c.tokens.supervisor, { motivo: 'teste' });
    expect(r.statusCode).toBe(404);
  });
  it('cancelar exige motivo', async () => {
    expect((await post(`/pedidos/${ids.v2}/cancelar`, c.tokens.admin, {})).statusCode).toBe(400);
  });
  it('cancela pedido aprovado, registra auditoria e não altera de novo', async () => {
    const r = await post(`/pedidos/${ids.v1}/cancelar`, c.tokens.supervisor, {
      motivo: 'Cliente desistiu',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('CANCELADO');
    const det = (await get(`/pedidos/${ids.v1}`, c.tokens.admin)).json();
    expect(det.motivoCancelamento).toBe('Cliente desistiu');
    expect(det.canceladoPor.nome).toBe('Sup A');
    expect(det.canceladoEm).toBeTruthy();
    expect(det.avaliadoPor.nome).toBe('Sup A'); // aprovação anterior continua registrada
    expect(
      (await post(`/pedidos/${ids.v1}/cancelar`, c.tokens.admin, { motivo: 'de novo' })).statusCode,
    ).toBe(409);
    expect((await post(`/pedidos/${ids.v1}/aprovar`, c.tokens.admin)).statusCode).toBe(409);
  });
  it('cancela pedido pendente e o status volta para o app do vendedor', async () => {
    const r = await post(`/pedidos/${ids.v2}/cancelar`, c.tokens.admin, {
      motivo: 'Pedido duplicado',
    });
    expect(r.statusCode).toBe(200);
    const dados = (
      await c.app.inject({
        method: 'GET',
        url: `/api/v1/sync/dados?deviceId=${dispositivo.deviceId}`,
        headers: auth(c.tokens.vendedor2),
      })
    ).json();
    expect(dados.statusPedidos).toContainEqual({
      id: ids.v2,
      numero: expect.any(Number),
      status: 'CANCELADO',
      motivoReprovacao: null,
      motivoCancelamento: 'Pedido duplicado',
    });
  });
  it('resumo e vendas da equipe deixam de contar cancelados', async () => {
    const r = (await get('/pedidos/resumo', c.tokens.supervisor)).json();
    expect(r).toMatchObject({ pendentes: 0, aprovados: 0, totalVendido: 0 });
    expect((await get('/pedidos/vendas-equipe', c.tokens.supervisor)).json()).toEqual([]);
  });
});
