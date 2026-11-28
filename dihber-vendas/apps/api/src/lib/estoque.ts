import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Pedidos que reservam estoque: pendentes e aprovados (faturar dá baixa; reprovar/cancelar libera). */
export const STATUS_RESERVA = ['PENDENTE', 'APROVADO'] as const;

type Cliente = Prisma.TransactionClient | typeof prisma;

/** Quantidade reservada (em UN) por produto. */
export async function reservadoPorProduto(produtoIds: string[], db: Cliente = prisma) {
  const mapa = new Map<string, number>();
  if (!produtoIds.length) return mapa;
  const grupos = await db.pedidoItem.groupBy({
    by: ['produtoId'],
    where: { produtoId: { in: produtoIds }, pedido: { status: { in: [...STATUS_RESERVA] } } },
    _sum: { qtdUnidades: true },
  });
  for (const g of grupos) mapa.set(g.produtoId, g._sum.qtdUnidades?.toNumber() ?? 0);
  return mapa;
}

/** Disponível = estoque − reservado (null quando o produto não controla estoque). */
export function disponivel(estoque: { toNumber(): number } | null, reservado: number) {
  if (estoque === null) return null;
  return Math.round((estoque.toNumber() - reservado) * 1000) / 1000;
}

/** Marca produtos como alterados para o próximo sync levar o disponível novo aos celulares. */
export async function marcarProdutosAlterados(produtoIds: string[], db: Cliente = prisma) {
  if (!produtoIds.length) return;
  await db.produto.updateMany({
    where: { id: { in: produtoIds } },
    data: { updatedAt: new Date() },
  });
}

/** Produtos de um pedido (para liberar/atualizar a reserva quando o status muda). */
export async function produtosDoPedido(pedidoId: string) {
  const itens = await prisma.pedidoItem.findMany({
    where: { pedidoId },
    select: { produtoId: true },
    distinct: ['produtoId'],
  });
  return itens.map((i) => i.produtoId);
}
