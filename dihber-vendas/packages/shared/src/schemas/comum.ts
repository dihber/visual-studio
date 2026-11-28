import { z } from 'zod';

const vazioParaUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const textoOpcional = z.preprocess(vazioParaUndefined, z.string().trim().optional());
export const emailOpcional = z.preprocess(
  vazioParaUndefined,
  z.string().trim().email('E-mail inválido').optional(),
);

export const listagemQuerySchema = z.object({
  busca: z.string().trim().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(500).default(20),
  ativo: z
    .enum(['true', 'false', 'todos'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListagemQuery = z.infer<typeof listagemQuerySchema>;

export interface Paginado<T> {
  dados: T[];
  total: number;
  pagina: number;
  porPagina: number;
}
