import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, montarCenario, prisma, type Cenario } from './helpers';

let c: Cenario;
beforeAll(async () => {
  c = await montarCenario();
});
afterAll(async () => {
  await c.app.close();
});

const login = (payload: object) =>
  c.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload });

describe('autenticação', () => {
  it('login válido retorna tokens e dados do usuário', async () => {
    const r = await login({ login: 'admin', senha: 'senha123', origem: 'web' });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.usuario.perfil).toBe('ADMIN');
    expect(body.usuario.senhaHash).toBeUndefined();
  });

  it('senha errada → 401', async () => {
    const r = await login({ login: 'admin', senha: 'errada', origem: 'web' });
    expect(r.statusCode).toBe(401);
    expect(r.json().erro).toBe('Usuário ou senha inválidos');
  });

  it('vendedor não acessa a web', async () => {
    const r = await login({ login: 'v1', senha: 'senha123', origem: 'web' });
    expect(r.statusCode).toBe(403);
  });

  it('admin e supervisor não acessam o app', async () => {
    expect((await login({ login: 'admin', senha: 'senha123', origem: 'app' })).statusCode).toBe(
      403,
    );
    expect((await login({ login: 'supa', senha: 'senha123', origem: 'app' })).statusCode).toBe(403);
  });

  it('login no app registra o dispositivo', async () => {
    const d = await prisma.dispositivo.findUnique({ where: { deviceId: 'dev-v1' } });
    expect(d?.modelo).toBe('Samsung SM-A155M');
  });

  it('usuário inativo não entra', async () => {
    await prisma.usuario.update({ where: { login: 'v2' }, data: { ativo: false } });
    const r = await login({ login: 'v2', senha: 'senha123', origem: 'app' });
    expect(r.statusCode).toBe(403);
    await prisma.usuario.update({ where: { login: 'v2' }, data: { ativo: true } });
  });

  it('refresh rotaciona o token e logout revoga', async () => {
    const { refreshToken } = (
      await login({ login: 'admin', senha: 'senha123', origem: 'web' })
    ).json();
    const r1 = await c.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(r1.statusCode).toBe(200);
    const novo = r1.json().refreshToken;
    expect(novo).not.toBe(refreshToken);
    // token antigo não vale mais
    const r2 = await c.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(r2.statusCode).toBe(401);
    await c.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: novo },
    });
    const r3 = await c.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: novo },
    });
    expect(r3.statusCode).toBe(401);
  });

  it('rota protegida sem token → 401', async () => {
    const r = await c.app.inject({ method: 'GET', url: '/api/v1/usuarios' });
    expect(r.statusCode).toBe(401);
  });

  it('acesso negado por perfil → 403', async () => {
    const r1 = await c.app.inject({
      method: 'GET',
      url: '/api/v1/usuarios',
      headers: auth(c.tokens.vendedor1),
    });
    expect(r1.statusCode).toBe(403);
    const r2 = await c.app.inject({
      method: 'GET',
      url: '/api/v1/usuarios',
      headers: auth(c.tokens.supervisor),
    });
    expect(r2.statusCode).toBe(403);
    const r3 = await c.app.inject({
      method: 'GET',
      url: '/api/v1/sync/dados',
      headers: auth(c.tokens.admin),
    });
    expect(r3.statusCode).toBe(403);
  });

  it('GET /auth/me', async () => {
    const r = await c.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: auth(c.tokens.supervisor),
    });
    expect(r.json().supervisor.nome).toBe('Supervisor A');
  });
});

describe('rate limit do login', () => {
  it('bloqueia após muitas tentativas para o mesmo login', async () => {
    const limite = Number(process.env.LOGIN_RATE_LIMIT);
    let ultimo = 0;
    for (let i = 0; i <= limite; i++) {
      ultimo = (await login({ login: 'alvo-forca-bruta', senha: 'x', origem: 'web' })).statusCode;
    }
    expect(ultimo).toBe(429);
    // outro login no mesmo IP continua funcionando
    expect((await login({ login: 'admin', senha: 'senha123', origem: 'web' })).statusCode).toBe(
      200,
    );
  });
});
