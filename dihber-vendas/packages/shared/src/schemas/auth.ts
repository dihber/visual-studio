import { z } from 'zod';

export const dispositivoSchema = z.object({
  deviceId: z.string().min(4).max(200),
  modelo: z.string().max(200).optional().nullable(),
  sistema: z.string().max(200).optional().nullable(),
  appVersao: z.string().max(50).optional().nullable(),
});
export type DispositivoInput = z.infer<typeof dispositivoSchema>;

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Informe o usuário'),
  senha: z.string().min(1, 'Informe a senha'),
  dispositivo: dispositivoSchema.optional(),
  /** 'web' ou 'app' — o app exige vínculo com vendedor; a web bloqueia vendedores. */
  origem: z.enum(['web', 'app']).default('web'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
