/**
 * Progresso estimado da geração do APK, a partir das etapas do GitHub Actions.
 * As etapas rápidas avançam pelo que já terminou; a etapa da Expo (a mais longa, sem
 * percentual próprio) avança pelo tempo, usando a duração do último build como referência.
 */
export interface PassoGithub {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  started_at?: string | null;
}

export interface Progresso {
  percentual: number;
  etapa: string;
  decorridoSeg: number;
  /** null quando já passou da estimativa */
  restanteSeg: number | null;
}

/** [início, fim] da faixa da barra para cada etapa do workflow, e o texto mostrado. */
const FAIXAS: { passo: RegExp; de: number; ate: number; texto: string }[] = [
  { passo: /^Set up job$/, de: 3, ate: 5, texto: 'Preparando o ambiente' },
  { passo: /Avisar o portal que começou/, de: 5, ate: 6, texto: 'Preparando o ambiente' },
  { passo: /checkout/i, de: 6, ate: 8, texto: 'Baixando o código do app' },
  { passo: /pnpm\/action-setup|setup-node/i, de: 8, ate: 12, texto: 'Preparando as ferramentas' },
  { passo: /Instalar dependências/, de: 12, ate: 22, texto: 'Instalando dependências' },
  {
    passo: /Gerar APK na Expo/,
    de: 22,
    ate: 96,
    texto: 'Gerando o APK na Expo (etapa mais longa)',
  },
  { passo: /Avisar o portal que terminou/, de: 96, ate: 99, texto: 'Finalizando' },
];

export const DURACAO_PADRAO_MS = 17 * 60_000;

export function calcularProgresso(o: {
  solicitadoEm: Date;
  agora: Date;
  passos: PassoGithub[] | null;
  duracaoReferenciaMs?: number | null;
}): Progresso {
  const estimativa = Math.max(5 * 60_000, o.duracaoReferenciaMs || DURACAO_PADRAO_MS);
  const decorrido = Math.max(0, o.agora.getTime() - o.solicitadoEm.getTime());
  const pelaHora = (decorrido / estimativa) * 100;
  const restante = estimativa - decorrido;
  const base = {
    decorridoSeg: Math.round(decorrido / 1000),
    restanteSeg: restante > 0 ? Math.round(restante / 1000) : null,
  };

  // localiza a etapa atual: a que está rodando, ou a última concluída
  const passos = o.passos ?? [];
  let faixa: (typeof FAIXAS)[number] | undefined;
  let rodando = false;
  for (const p of passos) {
    // etapas de limpeza do GitHub ("Post Run ...", "Complete job") não contam
    if (/^(Post |Complete job)/.test(p.name)) continue;
    const f = FAIXAS.find((x) => x.passo.test(p.name));
    if (!f) continue;
    if (p.status === 'in_progress') {
      faixa = f;
      rodando = true;
      break;
    }
    if (p.status === 'completed') faixa = f;
  }

  if (!faixa) {
    // ainda na fila do GitHub
    return {
      ...base,
      percentual: Math.round(Math.min(pelaHora, 3)) || 1,
      etapa: 'Na fila do GitHub',
    };
  }
  // dentro da faixa da etapa, avança pelo tempo (sem passar do fim da faixa)
  const inicio = rodando ? faixa.de : faixa.ate;
  const percentual = Math.min(faixa.ate - 1, Math.max(inicio, pelaHora));
  return { ...base, percentual: Math.max(1, Math.round(percentual)), etapa: faixa.texto };
}
