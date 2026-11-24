import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  ativoSchema,
  listagemQuerySchema,
  PERFIS,
  usuarioAtualizarSchema,
  usuarioCriarSchema,
  usuarioSenhaSchema,
} from '@dihber/shared';
import { prisma } from '../../lib/prisma';
import { ErroHttp, naoEncontrado } from '../../lib/erros';
import { contem, filtroAtivo, paginar } from '../../lib/paginacao';
import { revogarSessoesDoUsuario } from '../auth/sessao';

const idParams = z.object({ id: z.string().uuid('ID inválido') });
const selectUsuario = {
  id: true,
  nome: true,
  login: true,
  perfil: true,
  ativo: true,
  vendedorId: true,
  supervisorId: true,
  vendedor: { select: { id: true, codigo: true, nome: true } },
  supervisor: { select: { id: true, codigo: true, nome: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export async function rotasUsuarios(app: FastifyInstance) {
  app.addHook('preHandler', app.autenticar);
  app.addHook('preHandler', app.exigirPerfil('ADMIN'));

  app.get('/usuarios', async (req) => {
    const q = listagemQuerySchema
      .extend({ perfil: z.enum(PERFIS).optional() })
      .parse(req.query);
    const where = {
      ...filtroAtivo(q),
      ...(q.perfil ? { perfil: q.perfil } : {}),
      ...contem(q.busca, ['nome', 'login']),
    };
    const [dados, total] = await Promise.all([
      prisma.usuario.findMany({ where, select: selectUsuario, orderBy: { nome: 'asc' }, ...paginar(q) }),
      prisma.usuario.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, porPagina: q.porPagina };
  });

  app.get('/usuarios/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const u = await prisma.usuario.findUnique({
      where: { id },
      select: {
        ...selectUsuario,
        dispositivos: { orderBy: { ultimoSync: { sort: 'desc', nulls: 'last' } } },
      },
    });
    if (!u) throw naoEncontrado('Usuário');
    return u;
  });

  app.post('/usuarios', async (req, reply) => {
    const { senha, ...dados } = usuarioCriarSchema.parse(req.body);
    const u = await prisma.usuario.create({
      data: { ...dados, senhaHash: await bcrypt.hash(senha, 10) },
      select: selectUsuario,
    });
    return reply.status(201).send(u);
  });

  app.put('/usuarios/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const dados = usuarioAtualizarSchema.parse(req.body);
    if (id === req.usuario.id && (!dados.ativo || dados.perfil !== 'ADMIN'))
      throw new ErroHttp(400, 'Você não pode inativar ou remover o perfil de administrador do próprio usuário');
    const u = await prisma.usuario.update({ where: { id }, data: dados, select: selectUsuario });
    if (!u.ativo) await revogarSessoesDoUsuario(id);
    return u;
  });

  app.patch('/usuarios/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const { ativo } = ativoSchema.parse(req.body);
    if (id === req.usuario.id && !ativo)
      throw new ErroHttp(400, 'Você não pode inativar o próprio usuário');
    const u = await prisma.usuario.update({ where: { id }, data: { ativo }, select: selectUsuario });
    if (!ativo) await revogarSessoesDoUsuario(id);
    return u;
  });

  app.patch('/usuarios/:id/senha', async (req) => {
    const { id } = idParams.parse(req.params);
    const { senha } = usuarioSenhaSchema.parse(req.body);
    await prisma.usuario.update({
      where: { id },
      data: { senhaHash: await bcrypt.hash(senha, 10) },
    });
    await revogarSessoesDoUsuario(id);
    return { ok: true };
  });
}
