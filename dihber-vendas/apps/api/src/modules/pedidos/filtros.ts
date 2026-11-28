import type { Prisma } from '@prisma/client';
import type { PedidosQuery } from '@dihber/shared';
import type { UsuarioToken } from '../../plugins/auth';
import { filtroVisibilidadePedidos } from '../../lib/visibilidade';

/** Brasília não tem horário de verão desde 2019: UTC-3 fixo. */
export const inicioDoDiaBrasilia = (data: string) => new Date(`${data}T00:00:00-03:00`);
export const fimDoDiaBrasilia = (data: string) =>
  new Date(inicioDoDiaBrasilia(data).getTime() + 24 * 3600 * 1000);

export function hojeBrasilia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function montarFiltroPedidos(
  u: UsuarioToken,
  q: Partial<PedidosQuery>,
): Prisma.PedidoWhereInput {
  const and: Prisma.PedidoWhereInput[] = [filtroVisibilidadePedidos(u)];
  if (q.status) and.push({ status: q.status });
  if (q.vendedorId) and.push({ vendedorId: q.vendedorId });
  if (q.supervisorId) and.push({ vendedor: { supervisorId: q.supervisorId } });
  if (q.clienteId) and.push({ clienteId: q.clienteId });
  if (q.dispositivoId) and.push({ dispositivoId: q.dispositivoId });
  if (q.dataInicio) and.push({ criadoNoAppEm: { gte: inicioDoDiaBrasilia(q.dataInicio) } });
  if (q.dataFim) and.push({ criadoNoAppEm: { lt: fimDoDiaBrasilia(q.dataFim) } });
  if (q.busca) {
    const n = Number(q.busca);
    and.push({
      OR: [
        ...(Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? [{ numero: n }] : []),
        { cliente: { razaoSocial: { contains: q.busca, mode: 'insensitive' } } },
        { cliente: { nomeFantasia: { contains: q.busca, mode: 'insensitive' } } },
        { cliente: { codigo: { contains: q.busca, mode: 'insensitive' } } },
        { vendedor: { nome: { contains: q.busca, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}
