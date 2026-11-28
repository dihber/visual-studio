import { API_URL } from '../lib/config';
import { carregarSessao, salvarSessao, type SessaoApp } from './sessao';

export class ErroSemConexao extends Error {
  constructor() {
    super('Sem conexão com o servidor. Verifique a internet e tente novamente.');
  }
}

export class ErroSessaoExpirada extends Error {
  constructor(msg = 'Sua sessão expirou. Entre novamente para sincronizar.') {
    super(msg);
  }
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 30_000;

async function chamar(caminho: string, init: RequestInit, token?: string): Promise<Response> {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${caminho}`, {
      ...init,
      signal: controle.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ErroSemConexao();
  } finally {
    clearTimeout(t);
  }
}

async function lerErro(r: Response): Promise<string> {
  const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
  return corpo.erro ?? `Erro ${r.status}`;
}

async function renovar(sessao: SessaoApp): Promise<SessaoApp> {
  const r = await chamar('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: sessao.refreshToken }),
  });
  if (r.status === 401 || r.status === 403)
    throw new ErroSessaoExpirada(r.status === 403 ? await lerErro(r) : undefined);
  if (!r.ok) throw new ErroApi(r.status, await lerErro(r));
  const nova = (await r.json()) as SessaoApp;
  await salvarSessao(nova);
  return nova;
}

/** Chamada autenticada: renova o token automaticamente quando expira. */
export async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let sessao = await carregarSessao();
  if (!sessao) throw new ErroSessaoExpirada('Faça login para sincronizar.');
  let r = await chamar(caminho, init, sessao.accessToken);
  if (r.status === 401) {
    sessao = await renovar(sessao);
    r = await chamar(caminho, init, sessao.accessToken);
    if (r.status === 401) throw new ErroSessaoExpirada();
  }
  if (!r.ok) throw new ErroApi(r.status, await lerErro(r));
  return (await r.json()) as T;
}

export async function apiPublica<T>(caminho: string, corpo: unknown): Promise<T> {
  const r = await chamar(caminho, { method: 'POST', body: JSON.stringify(corpo) });
  if (!r.ok) throw new ErroApi(r.status, await lerErro(r));
  return (await r.json()) as T;
}
