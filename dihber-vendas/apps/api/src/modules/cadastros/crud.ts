import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
import { ativoSchema, listagemQuerySchema, type Perfil } from '@dihber/shared';
import { prisma } from '../../lib/prisma';
import { naoEncontrado } from '../../lib/erros';
import { contem, filtroAtivo, paginar } from '../../lib/paginacao';

const idParams = z.object({ id: z.string().uuid('ID inválido') });

type Modelo = 'supervisor' | 'vendedor' | 'cliente' | 'produto';

interface OpcoesCrud {
  rota: string;
  modelo: Modelo;
  nomeExibicao: string;
  schema: ZodTypeAny;
  camposBusca: string[];
  ordenarPor: string;
  include?: Record<string, unknown>;
  includeDetalhe?: Record<string, unknown>;
  /** Perfis que podem consultar (escrita é sempre ADMIN). */
  perfisLeitura: Perfil[];
  /** Restrição extra de leitura por usuário (ex.: supervisor só vê sua equipe). */
  filtroLeitura?: (req: FastifyRequest) => Record<string, unknown>;
  /** Busca personalizada (substitui a busca padrão por camposBusca). */
  montarBusca?: (busca: string) => Record<string, unknown>;
  /** Filtros extras aceitos na query string. */
  filtrosExtras?: (query: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * CRUD padrão de cadastros: listar (busca/paginação/ativo), detalhar, criar, alterar e
 * ativar/inativar. Não há exclusão física (regra da especificação).
 */
export function registrarCrud(app: FastifyInstance, o: OpcoesCrud) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[o.modelo];
  const leitura = { preHandler: [app.autenticar, app.exigirPerfil(...o.perfisLeitura)] };
  const escrita = { preHandler: [app.autenticar, app.exigirPerfil('ADMIN')] };

  app.get(o.rota, leitura, async (req) => {
    const q = listagemQuerySchema.parse(req.query);
    const where = {
      AND: [
        filtroAtivo(q),
        q.busca && o.montarBusca ? o.montarBusca(q.busca) : contem(q.busca, o.camposBusca),
        o.filtroLeitura?.(req) ?? {},
        o.filtrosExtras?.(req.query as Record<string, unknown>) ?? {},
      ],
    };
    const [dados, total] = await Promise.all([
      delegate.findMany({
        where,
        include: o.include,
        orderBy: { [o.ordenarPor]: 'asc' },
        ...paginar(q),
      }),
      delegate.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, porPagina: q.porPagina };
  });

  app.get(`${o.rota}/:id`, leitura, async (req) => {
    const { id } = idParams.parse(req.params);
    const registro = await delegate.findFirst({
      where: { AND: [{ id }, o.filtroLeitura?.(req) ?? {}] },
      include: o.includeDetalhe ?? o.include,
    });
    if (!registro) throw naoEncontrado(o.nomeExibicao);
    return registro;
  });

  app.post(o.rota, escrita, async (req, reply) => {
    const dados = o.schema.parse(req.body);
    const criado = await delegate.create({ data: dados, include: o.include });
    return reply.status(201).send(criado);
  });

  app.put(`${o.rota}/:id`, escrita, async (req) => {
    const { id } = idParams.parse(req.params);
    const dados = o.schema.parse(req.body);
    return delegate.update({ where: { id }, data: dados, include: o.include });
  });

  app.patch(`${o.rota}/:id`, escrita, async (req) => {
    const { id } = idParams.parse(req.params);
    const { ativo } = ativoSchema.parse(req.body);
    return delegate.update({ where: { id }, data: { ativo }, include: o.include });
  });
}
