import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, dispositivo, montarCenario, novoPedido, prisma, type Cenario } from './helpers';

let c: Cenario;
let pedidoA: string;

beforeAll(async () => {
  c = await montarCenario();
  // produto 1: estoque 10 UN, comissão 5%  (preço 10,50; CX = 6 UN)
  await prisma.produto.update({
    where: { id: c.produto.id },
    data: { estoque: 10, comissaoPercentual: 5 },
  });
});
afterAll(async () => {
  await c.app.close();
});

const req = (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  url: string,
  token: string,
  payload?: object,
) => c.app.inject({ method, url: `/api/v1${url}`, headers: auth(token), payload });
const enviar = async (token: string, pedidos: unknown[]) =>
  (
    await c.app.inject({
      method: 'POST',
      url: '/api/v1/sync/pedidos',
      headers: auth(token),
      payload: { dispositivo, pedidos },
    })
  ).json();
const un = (produtoId: string, quantidade: number, tipoEmbalagem: 'UN' | 'CX' = 'UN') => ({
  produtoId,
  tipoEmbalagem,
  quantidade,
});
const produto1 = async (token = c.tokens.admin) =>
  (await req('GET', `/produtos/${c.produto.id}`, token)).json();

describe('estoque reservado', () => {
  it('pedido recebido reserva o estoque', async () => {
    const p = novoPedido(c.cliente.id, [un(c.produto.id, 6)], { formaPagamento: 'PIX' });
    pedidoA = p.id;
    expect((await enviar(c.tokens.vendedor1, [p])).aceitos).toHaveLength(1);
    expect(await produto1()).toMatchObject({
      estoque: 10,
      estoqueReservado: 6,
      estoqueDisponivel: 4,
    });
    const lista = (await req('GET', '/produtos?busca=ARROZ', c.tokens.admin)).json();
    expect(lista.dados[0]).toMatchObject({ estoqueReservado: 6, estoqueDisponivel: 4 });
  });

  it('mostra os pedidos que estão reservando', async () => {
    const r = (await req('GET', `/produtos/${c.produto.id}/reservas`, c.tokens.admin)).json();
    expect(r).toMatchObject({ estoque: 10, reservado: 6, disponivel: 4 });
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0]).toMatchObject({
      qtdUnidades: 6,
      pedido: { id: pedidoA, status: 'PENDENTE' },
    });
    // supervisor de outra equipe não vê o pedido do vendedor 1
    const b = (await req('GET', `/produtos/${c.produto.id}/reservas`, c.tokens.supervisorB)).json();
    expect(b.pedidos).toHaveLength(0);
    expect(b.reservado).toBe(6);
  });

  it('bloqueia pedido acima do disponível (UN e CX)', async () => {
    const r = await enviar(c.tokens.vendedor2, [
      novoPedido(c.cliente.id, [un(c.produto.id, 5)], { formaPagamento: 'PIX' }),
      novoPedido(c.cliente.id, [un(c.produto.id, 1, 'CX')], { formaPagamento: 'PIX' }), // 6 UN
    ]);
    expect(r.aceitos).toHaveLength(0);
    expect(r.rejeitados[0].erro).toBe(
      'Estoque insuficiente: P1 - ARROZ 5KG (disponível 4 UN, pedido 5 UN)',
    );
    expect(r.rejeitados[1].erro).toMatch(/disponível 4 UN, pedido 6 UN/);
  });

  it('aprovado continua reservando', async () => {
    await req('POST', `/pedidos/${pedidoA}/aprovar`, c.tokens.admin);
    expect((await produto1()).estoqueReservado).toBe(6);
  });

  it('cancelar libera o estoque e avisa os celulares no próximo sync', async () => {
    const antes = new Date(Date.now() - 1000).toISOString();
    await req('POST', `/pedidos/${pedidoA}/cancelar`, c.tokens.admin, {
      motivo: 'Cliente desistiu',
    });
    expect(await produto1()).toMatchObject({ estoqueReservado: 0, estoqueDisponivel: 10 });
    const d = (
      await c.app.inject({
        method: 'GET',
        url: `/api/v1/sync/dados?desde=${encodeURIComponent(antes)}`,
        headers: auth(c.tokens.vendedor1),
      })
    ).json();
    expect(d.produtos.find((x: { id: string }) => x.id === c.produto.id).estoqueDisponivel).toBe(
      10,
    );
  });

  it('dois pedidos ao mesmo tempo não usam o mesmo saldo', async () => {
    const [a, b] = await Promise.all([
      enviar(c.tokens.vendedor1, [
        novoPedido(c.cliente.id, [un(c.produto.id, 7)], { formaPagamento: 'PIX' }),
      ]),
      enviar(c.tokens.vendedor2, [
        novoPedido(c.cliente.id, [un(c.produto.id, 7)], { formaPagamento: 'PIX' }),
      ]),
    ]);
    expect(a.aceitos.length + b.aceitos.length).toBe(1);
    expect((await produto1()).estoqueReservado).toBe(7);
  });

  it('produto sem estoque cadastrado não tem limite', async () => {
    const r = await enviar(c.tokens.vendedor1, [
      novoPedido(c.cliente.id, [un(c.produto2.id, 9999)], { formaPagamento: 'PIX' }),
    ]);
    expect(r.aceitos).toHaveLength(1);
    expect(
      (await req('GET', `/produtos/${c.produto2.id}`, c.tokens.admin)).json().estoqueDisponivel,
    ).toBeNull();
  });
});

describe('comissão', () => {
  it('grava a comissão de cada item com o % do momento', async () => {
    await prisma.produto.update({ where: { id: c.produto.id }, data: { estoque: 1000 } });
    const p = novoPedido(c.cliente.id, [un(c.produto.id, 10), un(c.produto2.id, 1)], {
      formaPagamento: 'PIX',
      criadoNoAppEm: '2025-12-01T01:00:00.000Z', // 30/11/2025 22h em Brasília → novembro/2025
    });
    expect((await enviar(c.tokens.vendedor1, [p])).aceitos).toHaveLength(1);
    const linhas = await prisma.comissaoItem.findMany({
      where: { pedidoId: p.id },
      include: { produto: true },
    });
    const arroz = linhas.find((l) => l.produtoId === c.produto.id)!;
    expect(arroz.valorBase.toNumber()).toBe(105); // 10 × 10,50
    expect(arroz.percentual.toNumber()).toBe(5);
    expect(arroz.valorComissao.toNumber()).toBe(5.25);
    expect(arroz.competencia).toBe('2025-11');
    expect(linhas.find((l) => l.produtoId === c.produto2.id)!.valorComissao.toNumber()).toBe(0);

    // mudar o % depois não altera pedidos já feitos
    await req('PUT', `/produtos/${c.produto.id}`, c.tokens.admin, {
      codigo: 'P1',
      descricao: 'ARROZ 5KG',
      embalagem: 'CX C/ 6 UN',
      qtdPorCaixa: 6,
      precoUnitario: 10.5,
      estoque: 1000,
      comissaoPercentual: 8,
    });
    const depois = await prisma.comissaoItem.findFirstOrThrow({
      where: { pedidoId: p.id, produtoId: c.produto.id },
    });
    expect(depois.percentual.toNumber()).toBe(5);

    const det = (await req('GET', `/pedidos/${p.id}`, c.tokens.admin)).json();
    expect(
      det.itens.find((i: { produto: { codigo: string } }) => i.produto.codigo === 'P1').comissao,
    ).toEqual({
      percentual: 5,
      valorComissao: 5.25,
    });
  });

  it('relatório mensal: faturamento e comissão só de faturados; aprovados viram previsão', async () => {
    const mes = '2025-11';
    const base = (await req('GET', `/comissoes/mensal?competencia=${mes}`, c.tokens.admin)).json();
    expect(base.vendedores).toHaveLength(0); // pedido ainda pendente

    const pedido = await prisma.comissaoItem.findFirstOrThrow({ where: { competencia: mes } });
    await prisma.pedido.update({ where: { id: pedido.pedidoId }, data: { status: 'APROVADO' } });
    const prev = (await req('GET', `/comissoes/mensal?competencia=${mes}`, c.tokens.admin)).json();
    expect(prev.vendedores[0]).toMatchObject({
      vendedor: { codigo: 'V1' },
      faturado: { pedidos: 0, faturamento: 0, comissao: 0 },
      previsao: { pedidos: 1, faturamento: 112.99, comissao: 5.25 },
    });

    await prisma.pedido.update({ where: { id: pedido.pedidoId }, data: { status: 'FATURADO' } });
    const fat = (
      await req('GET', `/comissoes/mensal?competencia=${mes}`, c.tokens.supervisor)
    ).json();
    expect(fat.vendedores[0].faturado).toEqual({ pedidos: 1, faturamento: 112.99, comissao: 5.25 });
    expect(fat.total.faturado.comissao).toBe(5.25);
    // supervisor de outra equipe não vê o vendedor 1
    const b = (
      await req('GET', `/comissoes/mensal?competencia=${mes}`, c.tokens.supervisorB)
    ).json();
    expect(b.vendedores).toHaveLength(0);

    const det = (
      await req(
        'GET',
        `/comissoes/detalhe?competencia=${mes}&vendedorId=${c.vend1.id}`,
        c.tokens.admin,
      )
    ).json();
    expect(det).toHaveLength(2);
    expect(det[0].statusTexto).toBe('Faturado');
  });

  it('vendedor não acessa o relatório', async () => {
    expect(
      (await req('GET', '/comissoes/mensal?competencia=2026-11', c.tokens.vendedor1)).statusCode,
    ).toBe(403);
  });
});
