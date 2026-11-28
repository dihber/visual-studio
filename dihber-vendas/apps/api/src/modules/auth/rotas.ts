import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema, refreshSchema } from '@dihber/shared';
import { prisma } from '../../lib/prisma';
import { ErroHttp } from '../../lib/erros';
import { ACCESS_TOKEN_EXPIRA, type UsuarioToken } from '../../plugins/auth';
import { registrarDispositivo } from './dispositivo';
import { criarSessao, hashToken } from './sessao';

const incluirVinculos = {
  vendedor: { select: { id: true, codigo: true, nome: true, ativo: true } },
  supervisor: { select: { id: true, codigo: true, nome: true, ativo: true } },
} as const;

type UsuarioComVinculos = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.usuario.findUnique<{ where: { id: string }; include: typeof incluirVinculos }>
    >
  >
>;

function validarAcesso(u: UsuarioComVinculos, origem: 'web' | 'app') {
  if (!u.ativo) throw new ErroHttp(403, 'Usuário inativo. Procure o administrador.');
  if (u.perfil === 'VENDEDOR') {
    if (origem === 'web')
      throw new ErroHttp(403, 'Vendedores acessam o sistema apenas pelo aplicativo.');
    if (!u.vendedor)
      throw new ErroHttp(
        403,
        'Seu usuário não está vinculado a um vendedor. Procure o administrador.',
      );
    if (!u.vendedor.ativo) throw new ErroHttp(403, 'Seu cadastro de vendedor está inativo.');
  }
  if (u.perfil === 'SUPERVISOR') {
    if (origem === 'app')
      throw new ErroHttp(403, 'O aplicativo é exclusivo para vendedores. Use o portal web.');
    if (!u.supervisor)
      throw new ErroHttp(
        403,
        'Seu usuário não está vinculado a um supervisor. Procure o administrador.',
      );
    if (!u.supervisor.ativo) throw new ErroHttp(403, 'Seu cadastro de supervisor está inativo.');
  }
  if (u.perfil === 'ADMIN' && origem === 'app')
    throw new ErroHttp(403, 'O aplicativo é exclusivo para vendedores. Use o portal web.');
}

function payload(u: UsuarioComVinculos): UsuarioToken {
  return {
    id: u.id,
    nome: u.nome,
    perfil: u.perfil,
    vendedorId: u.vendedorId,
    supervisorId: u.supervisorId,
  };
}

function dadosUsuario(u: UsuarioComVinculos) {
  return {
    id: u.id,
    nome: u.nome,
    login: u.login,
    perfil: u.perfil,
    vendedor: u.vendedor,
    supervisor: u.supervisor,
  };
}

/**
 * Login sem diferenciar maiúsculas/minúsculas ("Diogo" = "diogo"). Se houver logins
 * antigos que só diferem na caixa, vale o que for idêntico ao digitado; sem um idêntico,
 * o login ambíguo é recusado.
 */
async function buscarPorLogin(login: string) {
  const candidatos = await prisma.usuario.findMany({
    where: { login: { equals: login, mode: 'insensitive' } },
    include: incluirVinculos,
    take: 5,
  });
  return (
    candidatos.find((c) => c.login === login) ?? (candidatos.length === 1 ? candidatos[0] : null)
  );
}

export async function rotasAuth(app: FastifyInstance) {
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: Number(process.env.LOGIN_RATE_LIMIT ?? 10),
          timeWindow: '1 minute',
          hook: 'preHandler',
          // por IP + login: um escritório atrás do mesmo IP não bloqueia todos os vendedores
          keyGenerator: (req: { ip: string; body?: unknown }) =>
            `${req.ip}:${String((req.body as { login?: unknown } | undefined)?.login ?? '').toLowerCase()}`,
        },
      },
    },
    async (req) => {
      const dados = loginSchema.parse(req.body);
      const u = await buscarPorLogin(dados.login);
      const ok = u ? await bcrypt.compare(dados.senha, u.senhaHash) : false;
      if (!u || !ok) throw new ErroHttp(401, 'Usuário ou senha inválidos');
      validarAcesso(u, dados.origem);

      if (dados.dispositivo) await registrarDispositivo(u.id, dados.dispositivo);

      const accessToken = app.jwt.sign(payload(u), { expiresIn: ACCESS_TOKEN_EXPIRA });
      const refreshToken = await criarSessao(u.id);
      return { accessToken, refreshToken, usuario: dadosUsuario(u) };
    },
  );

  app.post('/auth/refresh', async (req) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const sessao = await prisma.sessao.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: { include: incluirVinculos } },
    });
    if (!sessao || sessao.revogadaEm || sessao.expiraEm < new Date())
      throw new ErroHttp(401, 'Sessão expirada. Faça login novamente.');
    const u = sessao.usuario;
    const origem = u.perfil === 'VENDEDOR' ? 'app' : 'web';
    validarAcesso(u, origem);

    // rotação do refresh token
    await prisma.sessao.update({ where: { id: sessao.id }, data: { revogadaEm: new Date() } });
    const novoRefresh = await criarSessao(u.id);
    const accessToken = app.jwt.sign(payload(u), { expiresIn: ACCESS_TOKEN_EXPIRA });
    return { accessToken, refreshToken: novoRefresh, usuario: dadosUsuario(u) };
  });

  app.post('/auth/logout', async (req) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) {
      await prisma.sessao.updateMany({
        where: { tokenHash: hashToken(parsed.data.refreshToken), revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
    }
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: [app.autenticar] }, async (req) => {
    const u = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      include: incluirVinculos,
    });
    if (!u) throw new ErroHttp(401, 'Usuário não encontrado');
    return dadosUsuario(u);
  });
}
