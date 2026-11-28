import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, dispositivo, montarCenario, novoPedido, prisma, type Cenario } from './helpers';

let c: Cenario;
let tabelaId: string;
let prazo30: string;
let prazo60: string;
let clienteNovo: string;

beforeAll(async () => {
  c = await montarCenario();
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

const enviar = (token: string, pedidos: unknown[]) =>
  c.app.inject({
    method: 'POST',
    url: '/api/v1/sync/pedidos',
    headers: auth(token),
    payload: { dispositivo, pedidos },
  });

const dados = async (token: string, desde?: string) =>
  (
    await c.app.inject({
      method: 'GET',
      url: `/api/v1/sync/dados${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`,
      headers: auth(token),
    })
  ).json();

describe('cadastros: tabela de preço e prazos', () => {
  it('cria tabela de preço e define preços por produto', async () => {
    const t = await req('POST', '/tabelas-preco', c.tokens.admin, {
      codigo: 'T-ITU',
      nome: 'Itupeva/SP',
      cidade: 'Itupeva',
      uf: 'sp',
    });
    expect(t.statusCode).toBe(201);
    expect(t.json().uf).toBe('SP');
    tabelaId = t.json().id;

    const put = await req('PUT', `/tabelas-preco/${tabelaId}/itens`, c.tokens.admin, {
      itens: [{ produtoId: c.produto.id, preco: 10.9 }],
    });
    expect(put.json()).toEqual({ ok: true, itens: 1 });

    const itens = (
      await req('GET', `/tabelas-preco/${tabelaId}/itens`, c.tokens.supervisor)
    ).json();
    const p1 = itens.find((i: { produtoId: string }) => i.produtoId === c.produto.id);
    const p2 = itens.find((i: { produtoId: string }) => i.produtoId === c.produto2.id);
    expect(p1).toMatchObject({ preco: 10.9, precoBase: 10.5 });
    expect(p2.preco).toBeNull();

    // supervisor não altera preços
    expect(
      (await req('PUT', `/tabelas-preco/${tabelaId}/itens`, c.tokens.supervisor, { itens: [] }))
        .statusCode,
    ).toBe(403);
  });

  it('remover o preço (null) volta o produto ao preço base', async () => {
    await req('PUT', `/tabelas-preco/${tabelaId}/itens`, c.tokens.admin, {
      itens: [{ produtoId: c.produto2.id, preco: 5 }],
    });
    const r = await req('PUT', `/tabelas-preco/${tabelaId}/itens`, c.tokens.admin, {
      itens: [{ produtoId: c.produto2.id, preco: null }],
    });
    expect(r.json().itens).toBe(1);
  });

  it('cria prazos', async () => {
    prazo30 = (
      await req('POST', '/prazos', c.tokens.admin, { codigo: 'P30', descricao: '30 dias' })
    ).json().id;
    prazo60 = (
      await req('POST', '/prazos', c.tokens.admin, { codigo: 'P60', descricao: '60 dias' })
    ).json().id;
    expect(prazo30).toBeTruthy();
    expect(prazo60).toBeTruthy();
  });
});

describe('cliente: carteira, tabela e prazos', () => {
  it('cria cliente vinculado a vendedor, tabela e prazo', async () => {
    const r = await req('POST', '/clientes', c.tokens.admin, {
      codigo: 'C50',
      razaoSocial: 'Mercado Itupeva',
      cpfCnpj: '11.444.777/0001-61',
      tabelaPrecoId: tabelaId,
      vendedorIds: [c.vend1.id],
      prazoIds: [prazo30],
    });
    expect(r.statusCode).toBe(201);
    clienteNovo = r.json().id;
    expect(r.json().tabelaPreco.codigo).toBe('T-ITU');
    expect(
      r.json().vendedores.map((v: { vendedor: { codigo: string } }) => v.vendedor.codigo),
    ).toEqual(['V1']);
    expect(r.json().prazos.map((p: { prazo: { descricao: string } }) => p.prazo.descricao)).toEqual(
      ['30 dias'],
    );

    const filtro = (await req('GET', `/clientes?vendedorId=${c.vend2.id}`, c.tokens.admin)).json();
    expect(filtro.dados.map((x: { codigo: string }) => x.codigo)).not.toContain('C50');
  });

  it('vínculo inexistente é recusado', async () => {
    const r = await req('PUT', `/clientes/${clienteNovo}`, c.tokens.admin, {
      codigo: 'C50',
      razaoSocial: 'Mercado Itupeva',
      cpfCnpj: '11444777000161',
      vendedorIds: [crypto.randomUUID()],
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('sync: só a carteira do vendedor', () => {
  it('carga completa traz só os clientes da carteira, com tabela e prazos', async () => {
    const v1 = await dados(c.tokens.vendedor1);
    const novo = v1.clientes.find((x: { id: string }) => x.id === clienteNovo);
    expect(novo).toMatchObject({
      tabelaPrecoId: tabelaId,
      prazos: [{ id: prazo30, descricao: '30 dias' }],
    });
    expect(v1.tabelasPreco).toEqual([
      { id: tabelaId, ativo: true, itens: [{ produtoId: c.produto.id, preco: 10.9 }] },
    ]);
    const v2 = await dados(c.tokens.vendedor2);
    expect(v2.clientes.map((x: { id: string }) => x.id)).not.toContain(clienteNovo);
    expect(v2.tabelasPreco).toEqual([]);
  });

  it('delta: entrar e sair da carteira, mudar preço e prazo', async () => {
    const base = (await dados(c.tokens.vendedor2)).servidorAgora;
    // entra na carteira do vendedor 2
    await req('PUT', `/clientes/${clienteNovo}`, c.tokens.admin, {
      codigo: 'C50',
      razaoSocial: 'Mercado Itupeva',
      cpfCnpj: '11444777000161',
      tabelaPrecoId: tabelaId,
      vendedorIds: [c.vend1.id, c.vend2.id],
      prazoIds: [prazo30, prazo60],
    });
    const d1 = await dados(c.tokens.vendedor2, base);
    expect(d1.clientes.map((x: { id: string }) => x.id)).toEqual([clienteNovo]);
    expect(d1.clientes[0].prazos).toHaveLength(2);
    expect(d1.tabelasPreco.map((t: { id: string }) => t.id)).toEqual([tabelaId]);

    // preço alterado: a tabela vai de novo no delta
    const base2 = d1.servidorAgora;
    await req('PUT', `/tabelas-preco/${tabelaId}/itens`, c.tokens.admin, {
      itens: [{ produtoId: c.produto.id, preco: 11.5 }],
    });
    const d2 = await dados(c.tokens.vendedor2, base2);
    expect(d2.clientes).toHaveLength(0);
    expect(d2.tabelasPreco[0].itens).toEqual([{ produtoId: c.produto.id, preco: 11.5 }]);

    // prazo inativado: cliente reenviado sem ele
    const base3 = d2.servidorAgora;
    await req('PATCH', `/prazos/${prazo60}`, c.tokens.admin, { ativo: false });
    const d3 = await dados(c.tokens.vendedor2, base3);
    expect(d3.clientes[0].prazos.map((p: { id: string }) => p.id)).toEqual([prazo30]);
    await req('PATCH', `/prazos/${prazo60}`, c.tokens.admin, { ativo: true });

    // sai da carteira do vendedor 2
    const base4 = (await dados(c.tokens.vendedor2)).servidorAgora;
    await req('PUT', `/clientes/${clienteNovo}`, c.tokens.admin, {
      codigo: 'C50',
      razaoSocial: 'Mercado Itupeva',
      cpfCnpj: '11444777000161',
      tabelaPrecoId: tabelaId,
      vendedorIds: [c.vend1.id],
      prazoIds: [prazo30],
    });
    const d4 = await dados(c.tokens.vendedor2, base4);
    expect(d4.clientes).toHaveLength(0);
    expect(d4.clientesRemovidos).toEqual([clienteNovo]);
  });
});

describe('pedido: carteira, pagamento e preço da tabela', () => {
  const item = (produtoId: string, quantidade = 1) => ({
    produtoId,
    tipoEmbalagem: 'UN' as const,
    quantidade,
  });

  it('recusa cliente fora da carteira', async () => {
    const r = (
      await enviar(c.tokens.vendedor2, [
        novoPedido(clienteNovo, [item(c.produto.id)], { formaPagamento: 'PIX' }),
      ])
    ).json();
    expect(r.rejeitados[0].erro).toMatch(/fora da sua carteira/);
  });

  it('boleto exige prazo vinculado ao cliente', async () => {
    const semPrazo = novoPedido(clienteNovo, [item(c.produto.id)], { formaPagamento: 'BOLETO' });
    const naoVinculado = novoPedido(clienteNovo, [item(c.produto.id)], {
      formaPagamento: 'BOLETO',
      prazoPagamentoId: prazo60,
    });
    const r = (await enviar(c.tokens.vendedor1, [semPrazo, naoVinculado])).json();
    expect(r.rejeitados.find((x: { id: string }) => x.id === semPrazo.id).erro).toMatch(
      /Boleto sem prazo/,
    );
    expect(r.rejeitados.find((x: { id: string }) => x.id === naoVinculado.id).erro).toMatch(
      /Prazo de pagamento não permitido/,
    );
  });

  it('boleto com prazo do cliente: grava a forma e usa o preço da tabela', async () => {
    const p = novoPedido(clienteNovo, [item(c.produto.id, 2), item(c.produto2.id, 1)], {
      formaPagamento: 'BOLETO',
      prazoPagamentoId: prazo30,
    });
    const r = (await enviar(c.tokens.vendedor1, [p])).json();
    expect(r.aceitos).toHaveLength(1);
    const salvo = await prisma.pedido.findUniqueOrThrow({
      where: { id: p.id },
      include: { itens: true },
    });
    expect(salvo.formaPagamento).toBe('BOLETO');
    expect(salvo.prazoDescricao).toBe('30 dias');
    const i1 = salvo.itens.find((i) => i.produtoId === c.produto.id)!;
    const i2 = salvo.itens.find((i) => i.produtoId === c.produto2.id)!;
    expect(i1.precoUnitario.toNumber()).toBe(11.5); // preço da tabela
    expect(i2.precoUnitario.toNumber()).toBe(7.99); // fora da tabela: preço base
    expect(salvo.valorTotal.toNumber()).toBe(30.99);

    const det = (await req('GET', `/pedidos/${p.id}`, c.tokens.admin)).json();
    expect(det).toMatchObject({ formaPagamento: 'BOLETO', prazoDescricao: '30 dias' });
    const csv = (await req('GET', '/pedidos/exportar', c.tokens.admin)).body;
    expect(csv).toContain('Boleto 30 dias');
  });

  it('PIX é sempre aceito; tabela inativa volta ao preço base', async () => {
    await req('PATCH', `/tabelas-preco/${tabelaId}`, c.tokens.admin, { ativo: false });
    const p = novoPedido(clienteNovo, [item(c.produto.id)], { formaPagamento: 'PIX' });
    expect((await enviar(c.tokens.vendedor1, [p])).json().aceitos).toHaveLength(1);
    const salvo = await prisma.pedido.findUniqueOrThrow({
      where: { id: p.id },
      include: { itens: true },
    });
    expect(salvo.formaPagamento).toBe('PIX');
    expect(salvo.itens[0].precoUnitario.toNumber()).toBe(10.5);
    const d = await dados(c.tokens.vendedor1, new Date(Date.now() - 60_000).toISOString());
    expect(d.tabelasPreco.find((t: { id: string }) => t.id === tabelaId).ativo).toBe(false);
    await req('PATCH', `/tabelas-preco/${tabelaId}`, c.tokens.admin, { ativo: true });
  });

  it('pedido de app antigo (sem forma de pagamento) continua sendo aceito', async () => {
    const p = novoPedido(clienteNovo, [item(c.produto.id)]);
    expect((await enviar(c.tokens.vendedor1, [p])).json().aceitos).toHaveLength(1);
    const salvo = await prisma.pedido.findUniqueOrThrow({ where: { id: p.id } });
    expect(salvo.formaPagamento).toBeNull();
  });
});
