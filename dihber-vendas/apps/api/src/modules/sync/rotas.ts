import type { FastifyInstance, FastifyRequest } from 'fastify';
import { dispositivoSchema, syncDadosQuerySchema, syncPedidosSchema } from '@dihber/shared';
import { prisma } from '../../lib/prisma';
import { ErroHttp } from '../../lib/erros';
import { registrarDispositivo } from '../auth/dispositivo';
import { montarDados, receberPedidos } from './servico';

/** Garante que o usuário e o vendedor continuam ativos (o token pode ter até 15 min). */
async function vendedorAtivo(req: FastifyRequest): Promise<string> {
  const u = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    include: { vendedor: true },
  });
  if (!u?.ativo) throw new ErroHttp(403, 'Usuário inativo. Procure o administrador.');
  if (!u.vendedor) throw new ErroHttp(403, 'Seu usuário não está vinculado a um vendedor.');
  if (!u.vendedor.ativo) throw new ErroHttp(403, 'Seu cadastro de vendedor está inativo.');
  return u.vendedor.id;
}

export async function rotasSync(app: FastifyInstance) {
  app.addHook('preHandler', app.autenticar);
  app.addHook('preHandler', app.exigirPerfil('VENDEDOR'));

  app.post('/sync/pedidos', { bodyLimit: 5 * 1024 * 1024 }, async (req) => {
    const vendedorId = await vendedorAtivo(req);
    const { dispositivo, pedidos } = syncPedidosSchema.parse(req.body);
    const disp = await registrarDispositivo(req.usuario.id, dispositivo);
    return receberPedidos(vendedorId, disp.id, pedidos);
  });

  app.get('/sync/dados', async (req) => {
    const vendedorId = await vendedorAtivo(req);
    const q = syncDadosQuerySchema.parse(req.query);
    const dados = await montarDados(vendedorId, q.desde);
    if (q.deviceId) {
      const d = dispositivoSchema.shape.deviceId.safeParse(q.deviceId);
      if (d.success) {
        await prisma.dispositivo.updateMany({
          where: { deviceId: q.deviceId, usuarioId: req.usuario.id },
          data: { ultimoSync: new Date() },
        });
      }
    }
    return dados;
  });
}
