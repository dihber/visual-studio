/**
 * Teste de integração app ⇄ API: executa o código real do app (login, repositório,
 * sincronização) contra a API rodando. Requer: API em API_E2E_URL e banco com seed.
 *   API_E2E_URL=http://localhost:3333/api/v1 pnpm --filter mobile test
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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
      gerarId: randomUUID,
    });
    await expect(auth.entrar('vendedor2', 'vend123')).rejects.toThrow(/pedidos não enviados/);
    m.excluirPedido(id);
    await auth.entrar('vendedor2', 'vend123');
    expect(m.contarProdutos()).toBe(0); // dados do anterior foram limpos
  });
});
