import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, dispositivo, montarCenario, novoPedido, prisma, type Cenario } from './helpers';

let c: Cenario;
beforeAll(async () => {
  c = await montarCenario();
});
afterAll(async () => {
  await c.app.close();
});

const enviar = (token: string, pedidos: unknown[]) =>
  c.app.inject({
    method: 'POST',
    url: '/api/v1/sync/pedidos',
    headers: auth(token),
    payload: { dispositivo, pedidos },
  });

const dados = (token: string, desde?: string) =>
  c.app.inject({
    method: 'GET',
    url: `/api/v1/sync/dados?deviceId=${dispositivo.deviceId}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}`,
    headers: auth(token),
  });

describe('POST /sync/pedidos', () => {
  it('aceita pedido, recalcula valores e registra vendedor/dispositivo', async () => {
    const p = novoPedido(
      c.cliente.id,
      [
        { produtoId: c.produto.id, tipoEmbalagem: 'CX', quantidade: 2 }, // 12 UN × 10,50 = 126,00
        { produtoId: c.produto2.id, tipoEmbalagem: 'UN', quantidade: 3 }, // 3 × 7,99 = 23,97
      ],
      { valorTotal: 1 }, // valor do app é ignorado
    );
    const r = await enviar(c.tokens.vendedor1, [p]);
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.aceitos).toHaveLength(1);
    expect(body.aceitos[0].numero).toBeGreaterThan(0);

    const salvo = await prisma.pedido.findUnique({
      where: { id: p.id },
      include: { itens: true, dispositivo: true },
    });
    expect(salvo!.valorTotal.toNumber()).toBe(149.97);
    expect(salvo!.vendedorId).toBe(c.vend1.id);
    expect(salvo!.dispositivo.deviceId).toBe(dispositivo.deviceId);
    const cx = salvo!.itens.find((i) => i.tipoEmbalagem === 'CX')!;
    expect(cx.qtdUnidades.toNumber()).toBe(12);
    expect(cx.valorTotal.toNumber()).toBe(126);
  });

  it('é idempotente: reenvio não duplica e devolve o mesmo número', async () => {
    const p = novoPedido(c.cliente.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: 1 },
    ]);
    const r1 = (await enviar(c.tokens.vendedor1, [p])).json();
    const r2 = (await enviar(c.tokens.vendedor1, [p])).json();
    expect(r2.aceitos[0].numero).toBe(r1.aceitos[0].numero);
    expect(await prisma.pedido.count({ where: { id: p.id } })).toBe(1);
    // envio concorrente
    const p2 = novoPedido(c.cliente.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: 1 },
    ]);
    const [a, b] = await Promise.all([
      enviar(c.tokens.vendedor1, [p2]),
      enviar(c.tokens.vendedor1, [p2]),
    ]);
    expect(a.json().aceitos[0].numero).toBe(b.json().aceitos[0].numero);
    expect(await prisma.pedidoItem.count({ where: { pedidoId: p2.id } })).toBe(1);
  });

  it('outro vendedor não consegue reaproveitar o id', async () => {
    const p = novoPedido(c.cliente.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: 1 },
    ]);
    await enviar(c.tokens.vendedor1, [p]);
    const r = (await enviar(c.tokens.vendedor2, [p])).json();
    expect(r.rejeitados[0].erro).toMatch(/já utilizado/);
  });

  it('rejeita cliente inativo, produto inexistente e pedido inválido sem afetar os demais', async () => {
    const ok = novoPedido(c.cliente.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: 5 },
    ]);
    const inativo = novoPedido(c.clienteInativo.id, [
      { produtoId: c.produto.id, tipoEmbalagem: 'UN', quantidade: 1 },
    ]);
    const semProduto = novoPedido(c.cliente.id, [
      { produtoId: crypto.randomUUID(), tipoEmbalagem: 'UN', quantidade: 1 },
    ]);
    const semItens = novoPedido(c.cliente.id, []);
    const r = (await enviar(c.tokens.vendedor1, [ok, inativo, semProduto, semItens])).json();
    expect(r.aceitos.map((a: { id: string }) => a.id)).toEqual([ok.id]);
    expect(r.rejeitados).toHaveLength(3);
    expect(r.rejeitados.find((x: { id: string }) => x.id === inativo.id).erro).toMatch(
      /Cliente inativo/,
    );
    expect(r.rejeitados.find((x: { id: string }) => x.id === semProduto.id).erro).toMatch(
      /Produto não encontrado/,
    );
    expect(r.rejeitados.find((x: { id: string }) => x.id === semItens.id).erro).toMatch(
      /sem itens/,
    );
  });

  it('somente vendedor sincroniza', async () => {
    const r = await enviar(c.tokens.supervisor, []);
    expect(r.statusCode).toBe(403);
  });
});

describe('GET /sync/dados', () => {
  it('carga completa traz apenas ativos e atualiza ultimoSync', async () => {
    const r = (await dados(c.tokens.vendedor1)).json();
    expect(r.servidorAgora).toBeTruthy();
    expect(r.clientes.map((x: { codigo: string }) => x.codigo)).toEqual(['C1']);
    expect(r.produtos).toHaveLength(2);
    expect(typeof r.produtos[0].precoUnitario).toBe('number');
    expect(r.statusPedidos.length).toBeGreaterThan(0);
    const d = await prisma.dispositivo.findUnique({ where: { deviceId: dispositivo.deviceId } });
    expect(d?.ultimoSync).toBeTruthy();
  });

  it('delta traz só o que mudou, incluindo inativados', async () => {
    const primeiro = (await dados(c.tokens.vendedor1)).json();
    const vazio = (await dados(c.tokens.vendedor1, primeiro.servidorAgora)).json();
    expect(vazio.clientes).toHaveLength(0);
    expect(vazio.produtos).toHaveLength(0);
    expect(vazio.statusPedidos).toHaveLength(0);

    await prisma.produto.update({ where: { id: c.produto2.id }, data: { ativo: false } });
    await prisma.cliente.update({
      where: { id: c.cliente.id },
      data: { telefone: '(11) 1234-5678' },
    });
    const delta = (await dados(c.tokens.vendedor1, primeiro.servidorAgora)).json();
    expect(delta.produtos).toHaveLength(1);
    expect(delta.produtos[0].ativo).toBe(false);
    expect(delta.clientes[0].telefone).toBe('(11) 1234-5678');
  });

  it('status de pedidos aprovados/reprovados volta para o app', async () => {
    const antes = (await dados(c.tokens.vendedor1)).json();
    const p = await prisma.pedido.findFirst({
      where: { vendedorId: c.vend1.id, status: 'PENDENTE' },
    });
    const rep = await c.app.inject({
      method: 'POST',
      url: `/api/v1/pedidos/${p!.id}/reprovar`,
      headers: auth(c.tokens.supervisor),
      payload: { motivo: 'Cliente com débito' },
    });
    expect(rep.statusCode).toBe(200);
    const depois = (await dados(c.tokens.vendedor1, antes.servidorAgora)).json();
    expect(depois.statusPedidos).toEqual([
      { id: p!.id, numero: p!.numero, status: 'REPROVADO', motivoReprovacao: 'Cliente com débito' },
    ]);
    // vendedor 2 não recebe status de pedidos do vendedor 1
    const v2 = (await dados(c.tokens.vendedor2)).json();
    expect(v2.statusPedidos).toHaveLength(0);
  });

  it('vendedor inativado não sincroniza', async () => {
    await prisma.vendedor.update({ where: { id: c.vend2.id }, data: { ativo: false } });
    const r = await dados(c.tokens.vendedor2);
    expect(r.statusCode).toBe(403);
    await prisma.vendedor.update({ where: { id: c.vend2.id }, data: { ativo: true } });
  });
});
