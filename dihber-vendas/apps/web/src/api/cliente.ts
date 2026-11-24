import type { Perfil } from '@dihber/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
const CHAVE = 'dihber.auth';

export interface UsuarioLogado {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  vendedor: { id: string; codigo: string; nome: string } | null;
  supervisor: { id: string; codigo: string; nome: string } | null;
}

export interface Sessao {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
    public campos?: { campo: string; mensagem: string }[],
  ) {
    super(message);
  }
}

export function lerSessao(): Sessao | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? (JSON.parse(s) as Sessao) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event('dihber:sessao'));
}

let renovando: Promise<boolean> | null = null;

async function renovarToken(): Promise<boolean> {
  const s = lerSessao();
  if (!s) return false;
  renovando ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      salvarSessao(await r.json());
      return true;
    })
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

export function montarQuery(params: Record<string, unknown> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function requisicaoBruta(caminho: string, init: RequestInit = {}, tentarRenovar = true): Promise<Response> {
  const s = lerSessao();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (s) headers.set('Authorization', `Bearer ${s.accessToken}`);

  let r: Response;
  try {
    r = await fetch(`${BASE}${caminho}`, { ...init, headers });
  } catch {
    throw new ErroApi(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }
  if (r.status === 401 && tentarRenovar && s && !caminho.startsWith('/auth/')) {
    if (await renovarToken()) return requisicaoBruta(caminho, init, false);
    salvarSessao(null);
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}));
    throw new ErroApi(r.status, corpo.erro ?? `Erro ${r.status}`, corpo.campos);
  }
  return r;
}

export async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await requisicaoBruta(caminho, init);
  return r.json() as Promise<T>;
}

export const http = {
  get: <T>(c: string, params?: Record<string, unknown>) => api<T>(c + montarQuery(params)),
  post: <T>(c: string, body?: unknown) => api<T>(c, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(c: string, body: unknown) => api<T>(c, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(c: string, body: unknown) => api<T>(c, { method: 'PATCH', body: JSON.stringify(body) }),
};

/** Baixa um arquivo autenticado (ex.: exportação CSV). */
export async function baixarArquivo(caminho: string, params: Record<string, unknown>, nome: string) {
  const r = await requisicaoBruta(caminho + montarQuery(params));
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export async function login(loginUsuario: string, senha: string): Promise<Sessao> {
  const s = await api<Sessao>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginUsuario, senha, origem: 'web' }),
  });
  salvarSessao(s);
  return s;
}

export async function logout() {
  const s = lerSessao();
  if (s) {
    fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    }).catch(() => undefined);
  }
  salvarSessao(null);
}
