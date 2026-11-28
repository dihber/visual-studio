import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montarCenario, prisma, type Cenario } from './helpers';

let c: Cenario;
beforeAll(async () => {
  c = await montarCenario();
});
afterAll(async () => {
  await c.app.close();
});
beforeEach(() => {
  delete process.env.GITHUB_TOKEN_APK;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GITHUB_TOKEN_APK;
});

const req = (method: 'GET' | 'POST', url: string, token?: string, payload?: object) =>
  c.app.inject({ method, url: `/api/v1${url}`, headers: token ? auth(token) : {}, payload });

/** Simula a API do GitHub: dispatch e consulta de execução. */
function simularGithub(opcoes: { dispatchStatus?: number; run?: Record<string, unknown> } = {}) {
  const chamadas: { url: string; body?: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    chamadas.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/dispatches')) {
      return new Response(
        opcoes.dispatchStatus === 204 || !opcoes.dispatchStatus ? null : '{"message":"Not Found"}',
        {
          status: opcoes.dispatchStatus ?? 204,
        },
      );
    }
    if (url.includes('/actions/runs/')) {
      return opcoes.run ? Response.json(opcoes.run) : new Response('{}', { status: 404 });
    }
    return new Response('{}', { status: 500 });
  });
  return chamadas;
}

describe('gerar APK', () => {
  it('sem GITHUB_TOKEN_APK informa que não está configurado', async () => {
    const r = await req('GET', '/app-builds', c.tokens.admin);
    expect(r.json()).toEqual({ configurado: false, builds: [] });
    const p = await req('POST', '/app-builds', c.tokens.admin);
    expect(p.statusCode).toBe(400);
    expect(p.json().erro).toMatch(/GITHUB_TOKEN_APK/);
  });

  it('só o admin gera; supervisor apenas consulta', async () => {
    process.env.GITHUB_TOKEN_APK = 't';
    expect((await req('POST', '/app-builds', c.tokens.supervisor)).statusCode).toBe(403);
    expect((await req('GET', '/app-builds', c.tokens.supervisor)).statusCode).toBe(200);
    expect((await req('GET', '/app-builds', c.tokens.vendedor1)).statusCode).toBe(403);
  });

  it('falha no GitHub vira build FALHOU com mensagem clara', async () => {
    process.env.GITHUB_TOKEN_APK = 't';
    simularGithub({ dispatchStatus: 404 });
    const r = await req('POST', '/app-builds', c.tokens.admin);
    expect(r.statusCode).toBe(502);
    expect(r.json().erro).toMatch(/gerar-apk\.yml não encontrado/);
    const lista = (await req('GET', '/app-builds', c.tokens.admin)).json();
    expect(lista.builds[0].status).toBe('FALHOU');
  });

  it('dispara o workflow, impede dois ao mesmo tempo e conclui pelo aviso do GitHub', async () => {
    process.env.GITHUB_TOKEN_APK = 't';
    const chamadas = simularGithub();
    const r = await req('POST', '/app-builds', c.tokens.admin);
    expect(r.statusCode).toBe(201);
    const build = r.json();
    expect(build.status).toBe('NA_FILA');
    expect(chamadas[0].url).toBe(
      'https://api.github.com/repos/dihber/visual-studio/actions/workflows/gerar-apk.yml/dispatches',
    );
    expect(chamadas[0].body).toEqual({
      ref: 'claude/charming-hopper-qngw2w',
      inputs: {
        build_id: build.id,
        callback_url: `http://localhost/api/v1/app-builds/${build.id}/callback`,
      },
    });

    expect((await req('POST', '/app-builds', c.tokens.admin)).statusCode).toBe(409);

    const run = {
      id: 555,
      path: '.github/workflows/gerar-apk.yml',
      display_title: `Gerar APK ${build.id}`,
      html_url: 'https://github.com/dihber/visual-studio/actions/runs/555',
      created_at: new Date().toISOString(),
    };
    vi.restoreAllMocks();
    simularGithub({ run });
    const cb = (body: object) =>
      req('POST', `/app-builds/${build.id}/callback`, undefined, { runId: '555', ...body });

    expect((await cb({ status: 'GERANDO' })).statusCode).toBe(200);
    // link fora da Expo é recusado
    expect(
      (await cb({ status: 'CONCLUIDO', urlDownload: 'https://site-falso.com/app.apk' })).statusCode,
    ).toBe(400);
    const ok = await cb({
      status: 'CONCLUIDO',
      urlDownload: 'https://expo.dev/artifacts/eas/abc.apk',
      versao: '1.0.0 (3)',
      easBuildId: 'eas-1',
    });
    expect(ok.statusCode).toBe(200);

    const lista = (await req('GET', '/app-builds', c.tokens.supervisor)).json();
    expect(lista.configurado).toBe(true);
    expect(lista.builds[0]).toMatchObject({
      status: 'CONCLUIDO',
      versao: '1.0.0 (3)',
      urlDownload: 'https://expo.dev/artifacts/eas/abc.apk',
      githubRunUrl: run.html_url,
      solicitadoPor: { nome: 'Admin' },
    });
  });

  it('recusa aviso de uma execução que não é deste build', async () => {
    process.env.GITHUB_TOKEN_APK = 't';
    simularGithub();
    const build = (await req('POST', '/app-builds', c.tokens.admin)).json();
    vi.restoreAllMocks();
    simularGithub({
      run: {
        id: 9,
        path: '.github/workflows/outro.yml',
        display_title: `Gerar APK ${build.id}`,
        html_url: 'x',
        created_at: new Date().toISOString(),
      },
    });
    const r = await req('POST', `/app-builds/${build.id}/callback`, undefined, {
      runId: '9',
      status: 'FALHOU',
    });
    expect(r.statusCode).toBe(403);
    await prisma.appBuild.update({ where: { id: build.id }, data: { status: 'FALHOU' } });
  });

  it('build parado há mais de 90 minutos aparece como falho', async () => {
    const b = await prisma.appBuild.create({
      data: {
        solicitadoPorId: (await prisma.usuario.findFirstOrThrow({ where: { login: 'admin' } })).id,
        solicitadoEm: new Date(Date.now() - 2 * 3600_000),
        status: 'GERANDO',
      },
    });
    const lista = (await req('GET', '/app-builds', c.tokens.admin)).json();
    const achado = lista.builds.find((x: { id: string }) => x.id === b.id);
    expect(achado.status).toBe('FALHOU');
    expect(achado.erro).toMatch(/90 minutos/);
  });
});
