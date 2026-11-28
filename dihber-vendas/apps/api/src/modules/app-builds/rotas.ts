import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ErroHttp, naoEncontrado } from '../../lib/erros';
import { buscarRun, configGithub, dispararWorkflow, WORKFLOW_ARQUIVO } from './github';

/** Builds parados há mais que isso são considerados perdidos. */
const LIMITE_MINUTOS = 90;
const EM_ANDAMENTO = ['NA_FILA', 'GERANDO'] as const;

const selectBuild = {
  id: true,
  status: true,
  solicitadoEm: true,
  concluidoEm: true,
  versao: true,
  urlDownload: true,
  githubRunUrl: true,
  erro: true,
  solicitadoPor: { select: { id: true, nome: true } },
} as const;

const callbackSchema = z.object({
  runId: z.string().regex(/^\d{1,20}$/),
  status: z.enum(['GERANDO', 'CONCLUIDO', 'FALHOU']),
  versao: z.string().max(60).optional().nullable(),
  easBuildId: z.string().max(100).optional().nullable(),
  urlDownload: z.string().url().max(1000).optional().nullable(),
  erro: z.string().max(1000).optional().nullable(),
});

/** Só aceita links de download da própria Expo (evita gravar um link qualquer). */
function linkDaExpo(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      ['expo.dev', 'expo.io'].some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
    );
  } catch {
    return false;
  }
}

function urlPublica(req: FastifyRequest) {
  const fixa = process.env.APP_URL_PUBLICA?.trim().replace(/\/+$/, '');
  if (fixa) return fixa;
  const local = /^(localhost|127\.|0\.0\.0\.0)/.test(req.hostname);
  return `${local ? 'http' : 'https'}://${req.hostname}`;
}

async function expirarAntigos() {
  await prisma.appBuild.updateMany({
    where: {
      status: { in: [...EM_ANDAMENTO] },
      solicitadoEm: { lt: new Date(Date.now() - LIMITE_MINUTOS * 60_000) },
    },
    data: {
      status: 'FALHOU',
      erro: `Sem resposta do GitHub em ${LIMITE_MINUTOS} minutos.`,
      concluidoEm: new Date(),
    },
  });
}

export async function rotasAppBuilds(app: FastifyInstance) {
  const leitura = { preHandler: [app.autenticar, app.exigirPerfil('ADMIN', 'SUPERVISOR')] };
  const escrita = { preHandler: [app.autenticar, app.exigirPerfil('ADMIN')] };

  /** Histórico (últimos 15) + se a geração está configurada. */
  app.get('/app-builds', leitura, async () => {
    await expirarAntigos();
    const builds = await prisma.appBuild.findMany({
      select: selectBuild,
      orderBy: { solicitadoEm: 'desc' },
      take: 15,
    });
    return { configurado: !!configGithub().token, builds };
  });

  /** Botão "Gerar APK". */
  app.post('/app-builds', escrita, async (req, reply) => {
    if (!configGithub().token) {
      throw new ErroHttp(
        400,
        'A geração de APK ainda não foi configurada: falta a variável GITHUB_TOKEN_APK na API.',
      );
    }
    await expirarAntigos();
    const andamento = await prisma.appBuild.findFirst({
      where: { status: { in: [...EM_ANDAMENTO] } },
    });
    if (andamento) throw new ErroHttp(409, 'Já existe um APK sendo gerado. Aguarde ele terminar.');

    const build = await prisma.appBuild.create({
      data: { solicitadoPorId: req.usuario.id },
      select: { id: true },
    });
    try {
      await dispararWorkflow(build.id, `${urlPublica(req)}/api/v1/app-builds/${build.id}/callback`);
    } catch (e) {
      const erro = (e as Error).message;
      await prisma.appBuild.update({
        where: { id: build.id },
        data: { status: 'FALHOU', erro, concluidoEm: new Date() },
      });
      req.log.error({ err: e, buildId: build.id }, 'Falha ao disparar geração de APK');
      throw new ErroHttp(502, erro);
    }
    return reply
      .status(201)
      .send(await prisma.appBuild.findUnique({ where: { id: build.id }, select: selectBuild }));
  });

  /**
   * Aviso de volta do GitHub Actions (sem login). A autenticidade é conferida na própria API do
   * GitHub: a execução informada precisa ser deste workflow e ter sido aberta para este build.
   */
  app.post('/app-builds/:id/callback', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const dados = callbackSchema.parse(req.body);
    const build = await prisma.appBuild.findUnique({ where: { id } });
    if (!build) throw naoEncontrado('Build');

    const run = await buscarRun(dados.runId);
    const valido =
      !!run &&
      run.path.endsWith(`.github/workflows/${WORKFLOW_ARQUIVO}`) &&
      run.display_title.includes(id) &&
      new Date(run.created_at).getTime() >= build.solicitadoEm.getTime() - 5 * 60_000;
    if (!valido) throw new ErroHttp(403, 'Execução do GitHub não confere com este build');

    if (dados.status === 'CONCLUIDO' && (!dados.urlDownload || !linkDaExpo(dados.urlDownload))) {
      throw new ErroHttp(400, 'Link de download inválido');
    }
    if (build.status === 'CONCLUIDO' || build.status === 'FALHOU') return { ok: true }; // já finalizado

    await prisma.appBuild.update({
      where: { id },
      data: {
        status: dados.status,
        githubRunId: dados.runId,
        githubRunUrl: run.html_url,
        ...(dados.status === 'CONCLUIDO'
          ? {
              urlDownload: dados.urlDownload,
              versao: dados.versao ?? null,
              easBuildId: dados.easBuildId ?? null,
              concluidoEm: new Date(),
            }
          : {}),
        ...(dados.status === 'FALHOU'
          ? {
              erro: dados.erro || 'O build falhou. Veja os detalhes no GitHub.',
              concluidoEm: new Date(),
            }
          : {}),
      },
    });
    return { ok: true };
  });
}
