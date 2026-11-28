import type { DispositivoInput } from '@dihber/shared';
import { prisma } from '../../lib/prisma';

/** Registra/atualiza o celular usado pelo usuário (login e cada sync). */
export async function registrarDispositivo(
  usuarioId: string,
  d: DispositivoInput,
  opcoes: { sync?: boolean } = {},
) {
  const dados = {
    modelo: d.modelo ?? null,
    sistema: d.sistema ?? null,
    appVersao: d.appVersao ?? null,
    usuarioId,
    ...(opcoes.sync ? { ultimoSync: new Date() } : {}),
  };
  return prisma.dispositivo.upsert({
    where: { deviceId: d.deviceId },
    create: { deviceId: d.deviceId, ...dados },
    update: dados,
  });
}
