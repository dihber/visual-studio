import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { STATUS_PEDIDO_LABEL } from '@dihber/shared';
import { prisma } from '../../lib/prisma';

const querySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use AAAA-MM)'),
  vendedorId: z.string().uuid().optional(),
});

const soma = (a: number, b: { toNumber(): number }) => Math.round((a + b.toNumber()) * 100) / 100;

/**
 * Relatório de comissão por vendedor no mês do pedido (horário de Brasília).
 * Faturamento e comissão contam só pedidos FATURADOS; "previsão" mostra os aprovados ainda
 * não faturados.
 */
export async function rotasComissoes(app: FastifyInstance) {
  app.addHook('preHandler', app.autenticar);
  app.addHook('preHandler', app.exigirPerfil('ADMIN', 'SUPERVISOR'));

  const filtro = (
    q: z.infer<typeof querySchema>,
    usuario: { perfil: string; supervisorId: string | null },
  ): Prisma.ComissaoItemWhereInput => ({
    competencia: q.competencia,
    pedido: { status: { in: ['FATURADO', 'APROVADO'] } },
    ...(q.vendedorId ? { vendedorId: q.vendedorId } : {}),
    // supervisor vê só a equipe
    ...(usuario.perfil === 'SUPERVISOR'
      ? { vendedor: { supervisorId: usuario.supervisorId ?? '-' } }
      : {}),
  });

  app.get('/comissoes/mensal', async (req) => {
    const q = querySchema.parse(req.query);
    const linhas = await prisma.comissaoItem.findMany({
      where: filtro(q, req.usuario),
      select: {
        pedidoId: true,
        valorBase: true,
        valorComissao: true,
        pedido: { select: { status: true } },
        vendedor: { select: { id: true, codigo: true, nome: true } },
      },
    });
    type Linha = {
      vendedor: { id: string; codigo: string; nome: string };
      faturado: { pedidos: Set<string>; faturamento: number; comissao: number };
      previsao: { pedidos: Set<string>; faturamento: number; comissao: number };
    };
    const porVendedor = new Map<string, Linha>();
    for (const l of linhas) {
      const v =
        porVendedor.get(l.vendedor.id) ??
        porVendedor
          .set(l.vendedor.id, {
            vendedor: l.vendedor,
            faturado: { pedidos: new Set(), faturamento: 0, comissao: 0 },
            previsao: { pedidos: new Set(), faturamento: 0, comissao: 0 },
          })
          .get(l.vendedor.id)!;
      const alvo = l.pedido.status === 'FATURADO' ? v.faturado : v.previsao;
      alvo.pedidos.add(l.pedidoId);
      alvo.faturamento = soma(alvo.faturamento, l.valorBase);
      alvo.comissao = soma(alvo.comissao, l.valorComissao);
    }
    const resumo = (x: Linha['faturado']) => ({
      pedidos: x.pedidos.size,
      faturamento: x.faturamento,
      comissao: x.comissao,
    });
    const vendedores = [...porVendedor.values()]
      .map((v) => ({
        vendedor: v.vendedor,
        faturado: resumo(v.faturado),
        previsao: resumo(v.previsao),
      }))
      .sort(
        (a, b) =>
          b.faturado.faturamento - a.faturado.faturamento ||
          b.previsao.faturamento - a.previsao.faturamento,
      );
    const total = (k: 'faturado' | 'previsao') =>
      vendedores.reduce(
        (t, v) => ({
          pedidos: t.pedidos + v[k].pedidos,
          faturamento: Math.round((t.faturamento + v[k].faturamento) * 100) / 100,
          comissao: Math.round((t.comissao + v[k].comissao) * 100) / 100,
        }),
        { pedidos: 0, faturamento: 0, comissao: 0 },
      );
    return {
      competencia: q.competencia,
      vendedores,
      total: { faturado: total('faturado'), previsao: total('previsao') },
    };
  });

  /** Itens com comissão de um vendedor no mês (faturados e aprovados a faturar). */
  app.get('/comissoes/detalhe', async (req) => {
    const q = querySchema.extend({ vendedorId: z.string().uuid() }).parse(req.query);
    const itens = await prisma.comissaoItem.findMany({
      where: filtro(q, req.usuario),
      select: {
        valorBase: true,
        percentual: true,
        valorComissao: true,
        produto: { select: { codigo: true, descricao: true } },
        pedidoItem: { select: { tipoEmbalagem: true, quantidade: true } },
        pedido: {
          select: {
            id: true,
            numero: true,
            status: true,
            criadoNoAppEm: true,
            cliente: { select: { razaoSocial: true, nomeFantasia: true } },
          },
        },
      },
      orderBy: [{ pedido: { numero: 'asc' } }, { produto: { descricao: 'asc' } }],
    });
    return itens.map((i) => ({ ...i, statusTexto: STATUS_PEDIDO_LABEL[i.pedido.status] }));
  });
}
