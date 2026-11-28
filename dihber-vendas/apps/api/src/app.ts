import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import auth from './plugins/auth';
import { registrarTratamentoErros } from './plugins/erros';
import { serializar } from './lib/prisma';
import { rotasAuth } from './modules/auth/rotas';
import { rotasUsuarios } from './modules/usuarios/rotas';
import { rotasCadastros } from './modules/cadastros/rotas';
import { rotasPedidos } from './modules/pedidos/rotas';
import { rotasSync } from './modules/sync/rotas';
import { rotasAppBuilds } from './modules/app-builds/rotas';

export async function criarApp(opcoes: FastifyServerOptions = {}) {
  const app = Fastify({ trustProxy: true, ...opcoes });

  const origens = (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim());
  await app.register(cors, {
    origin: origens.includes('*') ? true : origens,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, { global: false });
  await app.register(auth);
  registrarTratamentoErros(app);

  // Decimal (Prisma) → number e remoção de campos sensíveis em todas as respostas JSON
  app.setReplySerializer((payload) => JSON.stringify(serializar(payload)));

  await app.register(
    async (api) => {
      api.get('/saude', async () => ({ ok: true, agora: new Date().toISOString() }));
      await api.register(rotasAuth);
      await api.register(rotasUsuarios);
      await api.register(rotasCadastros);
      await api.register(rotasPedidos);
      await api.register(rotasSync);
      await api.register(rotasAppBuilds);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
