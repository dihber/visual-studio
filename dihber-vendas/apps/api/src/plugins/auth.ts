import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Perfil } from '@dihber/shared';
import { ErroHttp } from '../lib/erros';

export interface UsuarioToken {
  id: string;
  nome: string;
  perfil: Perfil;
  vendedorId: string | null;
  supervisorId: string | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UsuarioToken;
    user: UsuarioToken;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioToken;
  }
  interface FastifyInstance {
    autenticar: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirPerfil: (...perfis: Perfil[]) => (req: FastifyRequest) => Promise<void>;
  }
}

export const ACCESS_TOKEN_EXPIRA = '15m';

export default fp(async (app) => {
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-troque' });
  app.decorateRequest('usuario', null as unknown as UsuarioToken);

  app.decorate('autenticar', async (req: FastifyRequest) => {
    try {
      const u = await req.jwtVerify<UsuarioToken>();
      req.usuario = u;
    } catch {
      throw new ErroHttp(401, 'Sessão expirada ou inválida. Faça login novamente.');
    }
  });

  app.decorate('exigirPerfil', (...perfis: Perfil[]) => async (req: FastifyRequest) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      throw new ErroHttp(403, 'Você não tem permissão para esta ação');
    }
  });
});
