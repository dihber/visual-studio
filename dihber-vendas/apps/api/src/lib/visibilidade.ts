import type { Prisma } from '@prisma/client';
import type { UsuarioToken } from '../plugins/auth';

/**
 * Regra de visibilidade (seção 6): aplicada em TODAS as consultas de pedidos.
 * - ADMIN: todos
 * - SUPERVISOR: pedidos dos vendedores da sua equipe
 * - VENDEDOR: somente os próprios pedidos
 */
export function filtroVisibilidadePedidos(u: UsuarioToken): Prisma.PedidoWhereInput {
  switch (u.perfil) {
    case 'ADMIN':
      return {};
    case 'SUPERVISOR':
      return { vendedor: { supervisorId: u.supervisorId ?? '__sem_supervisor__' } };
    case 'VENDEDOR':
      return { vendedorId: u.vendedorId ?? '__sem_vendedor__' };
  }
}
