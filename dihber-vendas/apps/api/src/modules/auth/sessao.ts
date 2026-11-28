import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma';

const DIAS_REFRESH = 30;
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function criarSessao(usuarioId: string) {
  const refreshToken = randomBytes(48).toString('hex');
  await prisma.sessao.create({
    data: {
      usuarioId,
      tokenHash: hashToken(refreshToken),
      expiraEm: new Date(Date.now() + DIAS_REFRESH * 24 * 3600 * 1000),
    },
  });
  return refreshToken;
}

export async function revogarSessoesDoUsuario(usuarioId: string) {
  await prisma.sessao.updateMany({
    where: { usuarioId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}
