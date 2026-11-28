/**
 * Integração com o GitHub Actions para gerar o APK (workflow .github/workflows/gerar-apk.yml).
 * Configuração (variáveis da API no Railway):
 * - GITHUB_TOKEN_APK    token "fine-grained" com permissão Actions: Read and write no repositório
 * - GITHUB_REPO     opcional, padrão "dihber/visual-studio"
 * - GITHUB_REF      opcional, branch usado no build, padrão "claude/charming-hopper-qngw2w"
 * - APP_URL_PUBLICA opcional, endereço público do portal (para o aviso de volta do GitHub)
 */
export const WORKFLOW_ARQUIVO = 'gerar-apk.yml';

export function configGithub() {
  return {
    token: process.env.GITHUB_TOKEN_APK?.trim() || null,
    repo: process.env.GITHUB_REPO?.trim() || 'dihber/visual-studio',
    ref: process.env.GITHUB_REF?.trim() || 'claude/charming-hopper-qngw2w',
  };
}

const cabecalhos = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'dihber-vendas',
});

async function lerErro(r: Response) {
  const corpo = (await r.json().catch(() => ({}))) as { message?: string };
  return corpo.message ?? `HTTP ${r.status}`;
}

/** Dispara o workflow. Lança erro com mensagem amigável se o GitHub recusar. */
export async function dispararWorkflow(buildId: string, callbackUrl: string) {
  const { token, repo, ref } = configGithub();
  if (!token) throw new Error('GITHUB_TOKEN_APK não configurado');
  const r = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_ARQUIVO}/dispatches`,
    {
      method: 'POST',
      headers: { ...cabecalhos(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, inputs: { build_id: buildId, callback_url: callbackUrl } }),
    },
  );
  if (r.status === 204) return;
  const msg = await lerErro(r);
  if (r.status === 401)
    throw new Error('O GitHub recusou o GITHUB_TOKEN_APK (inválido ou expirado).');
  if (r.status === 403)
    throw new Error(
      'O GITHUB_TOKEN_APK não tem permissão "Actions: Read and write" no repositório.',
    );
  if (r.status === 404)
    throw new Error(
      `Workflow ${WORKFLOW_ARQUIVO} não encontrado no branch padrão do repositório ${repo} (${msg}).`,
    );
  throw new Error(`O GitHub recusou o pedido: ${msg}`);
}

export interface RunGithub {
  id: number;
  path: string;
  display_title: string;
  html_url: string;
  created_at: string;
}

/** Busca uma execução do GitHub Actions (usada para validar o aviso de volta). */
export async function buscarRun(runId: string): Promise<RunGithub | null> {
  const { token, repo } = configGithub();
  if (!token || !/^\d{1,20}$/.test(runId)) return null;
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}`, {
    headers: cabecalhos(token),
  });
  if (!r.ok) return null;
  return (await r.json()) as RunGithub;
}

/** Etapas (steps) do job que gera o APK, para mostrar o progresso. */
export async function buscarPassosRun(
  runId: string,
): Promise<{ name: string; status: string; started_at?: string | null }[] | null> {
  const { token, repo } = configGithub();
  if (!token || !/^\d{1,20}$/.test(runId)) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, {
      headers: cabecalhos(token),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      jobs?: { steps?: { name: string; status: string; started_at?: string | null }[] }[];
    };
    return j.jobs?.[0]?.steps ?? null;
  } catch {
    return null;
  }
}
