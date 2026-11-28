/**
 * Teste de integração app ⇄ API: executa o código real do app (login, repositório,
 * sincronização) contra a API rodando. Requer: API em API_E2E_URL e banco com seed.
 *   API_E2E_URL=http://localhost:3333/api/v1 pnpm --filter mobile test
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const API = process.env.API_E2E_URL;
process.env.EXPO_PUBLIC_API_URL = API;

vi.mock('expo-sqlite', () => import('./expo-sqlite-node'));
vi.mock('expo-secure-store', () => {
  const m = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => m.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void m.set(k, v),
    deleteItemAsync: async (k: string) => void m.delete(k),
  };
});
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('expo-device', () => ({
  manufacturer: 'Samsung',
  modelName: 'SM-TESTE',
  osName: 'Android',
  osVersion: '14',
}));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0-teste', extra: {} } },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe.skipIf(!API)('integração app ⇄ API', () => {
  let m: typeof import('../src/db/repositorio');
  let sync: typeof import('../src/sync/sincronizar');
  let auth: typeof import('../src/sync/auth');
  let dbm: typeof import('../src/db');

  beforeAll(async () => {
    dbm = await import('../src/db');
    dbm.migrarBanco();
    m = await import('../src/db/repositorio');
    sync = await import('../src/sync/sincronizar');
    auth = await import('../src/sync/auth');
  });

  it('login e carga inicial', async () => {
    const s = await auth.entrar('vendedor1', 'vend123');
    expect(s.usuario.vendedor?.codigo).toBe('07');
    const etapas: string[] = [];
    const r = await sync.sincronizar((e) => etapas.push(e.map((x) => x.estado).join(',')));
    expect(r.clientes.novos).toBeGreaterThan(0);
    expect(m.contarProdutos()).toBeGreaterThan(0);
    expect(dbm.lerMeta('desde')).toBeTruthy();
    expect(etapas.at(-1)).toBe('ok,ok,ok,ok');
  });

  it('busca local de produto é rápida e ignora acentos', () => {
    const t = performance.now();
    const r = m.buscarProdutos('feijao');
    expect(performance.now() - t).toBeLessThan(300);
    expect(r[0]?.descricao).toMatch(/FEIJÃO/);
  });

  it('pedido offline → sincroniza → recebe número; reenvio não duplica; status volta', async () => {
    const cliente = m.buscarClientes('')[0];
    const produto = m.buscarProdutos('arroz')[0];
    const id = randomUUID();
    m.salvarPedido({
      id,
      cliente,
      itens: [{ produto, tipoEmbalagem: 'CX', quantidade: 2 }],
      observacao: 'teste integração',
      gerarId: randomUUID,
    });
    expect(m.contarNaoEnviados()).toBe(1);

    const r = await sync.sincronizar(() => undefined);
    expect(r.enviados).toBe(1);
    const enviado = m.obterPedido(id)!.pedido;
    expect(enviado.situacao).toBe('ENVIADO');
    expect(enviado.numero).toBeGreaterThan(0);
    expect(() => m.excluirPedido(id)).toThrow();

    // supervisor reprova pela "web"
    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'supervisor', senha: 'super123', origem: 'web' }),
    }).then((x) => x.json());
    const rep = await fetch(`${API}/pedidos/${id}/reprovar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` },
      body: JSON.stringify({ motivo: 'Teste de integração' }),
    });
    expect(rep.status).toBe(200);

    const r2 = await sync.sincronizar(() => undefined);
    expect(r2.enviados).toBe(0);
    expect(r2.statusAtualizados).toBe(1);
    const final = m.obterPedido(id)!.pedido;
    expect(final.status).toBe('REPROVADO');
    expect(final.motivoReprovacao).toBe('Teste de integração');
    expect(final.numero).toBe(enviado.numero);
  });

  it('pedido cancelado no portal volta para o app com o motivo', async () => {
    const cliente = m.buscarClientes('')[0];
    const produto = m.buscarProdutos('arroz')[0];
    const id = randomUUID();
    m.salvarPedido({
      id,
      cliente,
      itens: [{ produto, tipoEmbalagem: 'UN', quantidade: 3 }],
      observacao: 'teste cancelamento',
      gerarId: randomUUID,
    });
    expect((await sync.sincronizar(() => undefined)).enviados).toBe(1);

    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'admin', senha: 'admin123', origem: 'web' }),
    }).then((x) => x.json());
    const can = await fetch(`${API}/pedidos/${id}/cancelar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` },
      body: JSON.stringify({ motivo: 'Cancelado no teste de integração' }),
    });
    expect(can.status).toBe(200);

    const r = await sync.sincronizar(() => undefined);
    expect(r.statusAtualizados).toBe(1);
    const final = m.obterPedido(id)!.pedido;
    expect(final.status).toBe('CANCELADO');
    expect(final.motivoCancelamento).toBe('Cancelado no teste de integração');
  });

  it('pedido recusado fica marcado com o erro e não se perde', async () => {
    const cliente = { ...m.buscarClientes('')[0], id: randomUUID() }; // cliente inexistente
    const produto = m.buscarProdutos('')[0];
    const id = randomUUID();
    m.salvarPedido({
      id,
      cliente,
      itens: [{ produto, tipoEmbalagem: 'UN', quantidade: 1 }],
      observacao: '',
      gerarId: randomUUID,
    });
    const r = await sync.sincronizar(() => undefined);
    expect(r.rejeitados[0].erro).toMatch(/Cliente não encontrado/);
    const p = m.obterPedido(id)!.pedido;
    expect(p.situacao).toBe('NAO_ENVIADO');
    expect(p.erroEnvio).toMatch(/Cliente não encontrado/);
    m.excluirPedido(id);
  });

  it('outro vendedor não entra com pedidos pendentes do anterior', async () => {
    const id = randomUUID();
    m.salvarPedido({
      id,
      cliente: m.buscarClientes('')[0],
      itens: [{ produto: m.buscarProdutos('')[0], tipoEmbalagem: 'UN', quantidade: 1 }],
      observacao: '',
      pagamento: { forma: 'PIX', prazoId: null, prazoDescricao: null },
      gerarId: randomUUID,
    });
    await expect(auth.entrar('vendedor2', 'vend123')).rejects.toThrow(/pedidos não enviados/);
    m.excluirPedido(id);
    await auth.entrar('vendedor2', 'vend123');
    expect(m.contarProdutos()).toBe(0); // dados do anterior foram limpos
  });
});

describe.skipIf(!API)('integração: carteira, tabela de preço e forma de pagamento', () => {
  let m: typeof import('../src/db/repositorio');
  let sync: typeof import('../src/sync/sincronizar');
  let auth: typeof import('../src/sync/auth');
  let token = '';
  const sufixo = randomUUID().slice(0, 6);
  const ids: Record<string, string> = {};
  type Cli = Record<string, unknown> & { id: string; codigo: string };
  const originais: Record<string, Cli> = {};

  const adm = async <T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> => {
    const r = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`${metodo} ${caminho}: ${JSON.stringify(j)}`);
    return j as T;
  };
  const clientePorCodigo = async (codigo: string) =>
    (await adm<{ dados: Cli[] }>('GET', `/clientes?busca=${codigo}&ativo=todos`)).dados.find(
      (c) => c.codigo === codigo,
    )!;
  const salvarCliente = (c: Cli, extra: Record<string, unknown>) =>
    adm('PUT', `/clientes/${c.id}`, {
      codigo: c.codigo,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cpfCnpj: c.cpfCnpj,
      telefone: c.telefone,
      email: c.email,
      endereco: c.endereco,
      cidade: c.cidade,
      uf: c.uf,
      ativo: true,
      ...extra,
    });

  beforeAll(async () => {
    m = await import('../src/db/repositorio');
    sync = await import('../src/sync/sincronizar');
    auth = await import('../src/sync/auth');
    token = (
      await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'admin', senha: 'admin123', origem: 'web' }),
      }).then((r) => r.json())
    ).accessToken;
    const vend = (
      await adm<{ dados: { id: string; codigo: string }[] }>('GET', '/vendedores?porPagina=100')
    ).dados;
    ids.v07 = vend.find((v) => v.codigo === '07')!.id;
    ids.v08 = vend.find((v) => v.codigo === '08')!.id;
    ids.prazo = (
      await adm<{ id: string }>('POST', '/prazos', {
        codigo: `IT30-${sufixo}`,
        descricao: `IT 30 dias ${sufixo}`,
      })
    ).id;
    ids.tabela = (
      await adm<{ id: string }>('POST', '/tabelas-preco', {
        codigo: `IT-${sufixo}`,
        nome: `Teste ${sufixo}`,
      })
    ).id;
    const arroz = (
      await adm<{ dados: { id: string; descricao: string }[] }>('GET', '/produtos?busca=ARROZ')
    ).dados[0];
    ids.arroz = arroz.id;
    await adm('PUT', `/tabelas-preco/${ids.tabela}/itens`, {
      itens: [{ produtoId: arroz.id, preco: 12.34 }],
    });

    originais.c9 = await clientePorCodigo('00009');
    originais.c10 = await clientePorCodigo('00010');
    // 00009: só do vendedor 07, com tabela e prazo; 00010: só do vendedor 08
    await salvarCliente(originais.c9, {
      vendedorIds: [ids.v07],
      tabelaPrecoId: ids.tabela,
      prazoIds: [ids.prazo],
    });
    await salvarCliente(originais.c10, { vendedorIds: [ids.v08], prazoIds: [] });
  });

  afterAll(async () => {
    // devolve os dois clientes para todos os vendedores, sem tabela e prazo de teste
    for (const c of [originais.c9, originais.c10])
      if (c)
        await salvarCliente(c, {
          vendedorIds: [ids.v07, ids.v08],
          tabelaPrecoId: null,
          prazoIds: [],
        });
    if (ids.tabela) await adm('PATCH', `/tabelas-preco/${ids.tabela}`, { ativo: false });
    if (ids.prazo) await adm('PATCH', `/prazos/${ids.prazo}`, { ativo: false });
  });

  it('carga completa traz só a carteira, com tabela e prazos', async () => {
    await auth.entrar('vendedor1', 'vend123');
    await sync.sincronizar(() => undefined);
    const c9 = m.buscarClientes('Ponto Certo')[0];
    expect(c9).toMatchObject({
      tabelaPrecoId: ids.tabela,
      prazos: [{ id: ids.prazo, descricao: `IT 30 dias ${sufixo}` }],
    });
    expect(m.buscarClientes('Distribuidora Sul')).toHaveLength(0);
    const arroz = m.buscarProdutos('arroz', c9.tabelaPrecoId)[0];
    expect(arroz.precoUnitario).toBe(12.34);
    expect(arroz.precoBase).toBe(27.9);
    expect(m.buscarProdutos('arroz', null)[0].precoUnitario).toBe(27.9);
  });

  it('boleto com prazo do cliente chega ao portal com o preço da tabela', async () => {
    const c9 = m.buscarClientes('Ponto Certo')[0];
    const id = randomUUID();
    m.salvarPedido({
      id,
      cliente: c9,
      itens: [
        {
          produto: m.buscarProdutos('arroz', c9.tabelaPrecoId)[0],
          tipoEmbalagem: 'UN',
          quantidade: 2,
        },
      ],
      observacao: '',
      pagamento: { forma: 'BOLETO', prazoId: ids.prazo, prazoDescricao: `IT 30 dias ${sufixo}` },
      gerarId: randomUUID,
    });
    expect(m.obterPedido(id)!.pedido.valorTotal).toBe(24.68);
    const r = await sync.sincronizar(() => undefined);
    expect(r.rejeitados).toEqual([]);
    const det = await adm<Record<string, unknown> & { itens: { precoUnitario: number }[] }>(
      'GET',
      `/pedidos/${id}`,
    );
    expect(det).toMatchObject({
      formaPagamento: 'BOLETO',
      prazoDescricao: `IT 30 dias ${sufixo}`,
      valorTotal: 24.68,
    });
    expect(det.itens[0].precoUnitario).toBe(12.34);
  });

  it('cliente que sai da carteira some do celular no próximo sync', async () => {
    await salvarCliente(originais.c9, {
      vendedorIds: [ids.v08],
      tabelaPrecoId: ids.tabela,
      prazoIds: [ids.prazo],
    });
    const r = await sync.sincronizar(() => undefined);
    expect(r.clientes.removidos).toBe(1);
    expect(m.buscarClientes('Ponto Certo')).toHaveLength(0);
  });

  it('estoque: disponível chega ao celular, desconta pedidos não enviados e o servidor reserva', async () => {
    type Prod = Record<string, unknown> & { id: string; estoque: number | null };
    const sal = (await adm<{ dados: Prod[] }>('GET', '/produtos?busca=SAL REFINADO')).dados[0];
    const original = sal.estoque;
    const salvarSal = (estoque: number | null) =>
      adm('PUT', `/produtos/${sal.id}`, {
        codigo: sal.codigo,
        descricao: sal.descricao,
        embalagem: sal.embalagem,
        qtdPorCaixa: sal.qtdPorCaixa,
        precoUnitario: sal.precoUnitario,
        comissaoPercentual: sal.comissaoPercentual,
        ativo: true,
        estoque,
      });
    try {
      // saldo 10 + o que já estiver reservado por outros pedidos
      const reservado = (await adm<{ reservado: number }>('GET', `/produtos/${sal.id}/reservas`))
        .reservado;
      await salvarSal(10 + reservado);
      await sync.sincronizar(() => undefined);
      const rascunho = await import('../src/lib/rascunho');
      const outroPedido = randomUUID();
      expect(m.saldoParaPedido(sal.id, outroPedido)).toBe(10);

      // pedido não enviado com 8 UN: outro pedido só pode usar 2
      const cliente = m.buscarClientes('')[0];
      const produto = m.buscarProdutos('sal refinado', cliente.tabelaPrecoId)[0];
      const id = randomUUID();
      m.salvarPedido({
        id,
        cliente,
        observacao: '',
        itens: [{ produto, tipoEmbalagem: 'UN', quantidade: 8 }],
        pagamento: { forma: 'PIX', prazoId: null, prazoDescricao: null },
        gerarId: randomUUID,
      });
      expect(m.saldoParaPedido(sal.id, outroPedido)).toBe(2);
      expect(m.saldoParaPedido(sal.id, id)).toBe(10); // editando o próprio pedido, ele não conta
      const tentativa = [{ produto, tipoEmbalagem: 'UN' as const, quantidade: 3 }];
      expect(
        rascunho.erroEstoque(tentativa, produto, m.saldoParaPedido(sal.id, outroPedido)),
      ).toMatch(/disponível 2 UN, no pedido 3 UN/);

      // envia: o servidor reserva e o celular recebe o disponível novo
      const r = await sync.sincronizar(() => undefined);
      expect(r.rejeitados).toEqual([]);
      expect(m.saldoParaPedido(sal.id, outroPedido)).toBe(2);
      expect(
        (await adm<{ disponivel: number }>('GET', `/produtos/${sal.id}/reservas`)).disponivel,
      ).toBe(2);
    } finally {
      await salvarSal(original);
    }
  });
});
