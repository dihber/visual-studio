import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export { Prisma };

/** Converte recursivamente Decimal do Prisma em number para o JSON de resposta. */
export function serializar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (Prisma.Decimal.isDecimal(valor)) return (valor as Prisma.Decimal).toNumber();
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (k === 'senhaHash') continue; // nunca expor hash de senha
      out[k] = serializar(v);
    }
    return out;
  }
  return valor;
}
