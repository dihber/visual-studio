import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  formatarCpfCnpj,
  cancelarSchema,
  formatarDataHora,
  pedidosQuerySchema,
  reprovarSchema,
  STATUS_PEDIDO_LABEL,
  textoPagamento,
} from '@dihber/shared';
import { prisma } from '../../lib/prisma';
import { ErroHttp, naoEncontrado } from '../../lib/erros';
import { filtroVisibilidadePedidos } from '../../lib/visibilidade';
import { paginar } from '../../lib/paginacao';
import { hojeBrasilia, inicioDoDiaBrasilia, montarFiltroPedidos } from './filtros';

const idParams = z.object({ id: z.string().uuid('ID inválido') });

const includeLista = {
  cliente: { select: { id: true, codigo: true, razaoSocial: true, nomeFantasia: true } },
  vendedor: {
    select: {
      id: true,
      codigo: true,
      nome: true,
      supervisor: { select: { id: true, nome: true } },
    },
  },
  dispositivo: { select: { id: true, modelo: true, sistema: true } },
  _count: { select: { itens: true } },
} as const;

export async function rotasPedidos(app: FastifyInstance) {
  app.addHook('preHandler', app.autenticar);

  app.get('/pedidos', async (req) => {
    const q = pedidosQuerySchema.parse(req.query);
    const where = montarFiltroPedidos(req.usuario, q);
    const [dados, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: includeLista,
        orderBy: { numero: 'desc' },
        ...paginar(q),
      }),
      prisma.pedido.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, porPagina: q.porPagina };
  });

  /** Contadores do topo da tela de pedidos. */
  app.get('/pedidos/resumo', async (req) => {
    const q = pedidosQuerySchema.partial().parse(req.query);
    const base = montarFiltroPedidos(req.usuario, { ...q, status: undefined });
    const hoje = hojeBrasilia();
    const [pendentesHoje, pendentes, aprovados, reprovados, vendido] = await Promise.all([
      prisma.pedido.count({
        where: {
          AND: [
            filtroVisibilidadePedidos(req.usuario),
            { status: 'PENDENTE', recebidoEm: { gte: inicioDoDiaBrasilia(hoje) } },
          ],
        },
      }),
      prisma.pedido.count({ where: { AND: [base, { status: 'PENDENTE' }] } }),
      prisma.pedido.count({ where: { AND: [base, { status: 'APROVADO' }] } }),
      prisma.pedido.count({ where: { AND: [base, { status: 'REPROVADO' }] } }),
      prisma.pedido.aggregate({
        where: { AND: [base, { status: { in: ['PENDENTE', 'APROVADO'] } }] },
        _sum: { valorTotal: true },
      }),
    ]);
    return {
      pendentesHoje,
      pendentes,
      aprovados,
      reprovados,
      totalVendido: vendido._sum.valorTotal?.toNumber() ?? 0,
    };
  });

  /** Painel "Vendas da equipe": total por vendedor no período (exclui reprovados/cancelados). */
  app.get(
    '/pedidos/vendas-equipe',
    { preHandler: [app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const q = pedidosQuerySchema.partial().parse(req.query);
      const where = {
        AND: [
          montarFiltroPedidos(req.usuario, { ...q, status: undefined }),
          { status: { in: ['PENDENTE', 'APROVADO'] as ('PENDENTE' | 'APROVADO')[] } },
        ],
      };
      const grupos = await prisma.pedido.groupBy({
        by: ['vendedorId'],
        where,
        _sum: { valorTotal: true },
        _count: { _all: true },
      });
      const vendedores = await prisma.vendedor.findMany({
        where: { id: { in: grupos.map((g) => g.vendedorId) } },
        select: { id: true, codigo: true, nome: true },
      });
      const porId = new Map(vendedores.map((v) => [v.id, v]));
      return grupos
        .map((g) => ({
          vendedor: porId.get(g.vendedorId),
          pedidos: g._count._all,
          total: g._sum.valorTotal?.toNumber() ?? 0,
        }))
        .sort((a, b) => b.total - a.total);
    },
  );

  app.get('/pedidos/exportar', async (req, reply) => {
    const q = pedidosQuerySchema.partial().parse(req.query);
    const pedidos = await prisma.pedido.findMany({
      where: montarFiltroPedidos(req.usuario, q),
      include: {
        ...includeLista,
        cliente: { select: { codigo: true, razaoSocial: true, cpfCnpj: true } },
        itens: { include: { produto: { select: { codigo: true, descricao: true } } } },
      },
      orderBy: { numero: 'desc' },
      take: 20000,
    });
    const linhas: (string | number)[][] = [
      [
        'Número',
        'Data',
        'Status',
        'Cliente (código)',
        'Cliente',
        'CPF/CNPJ',
        'Vendedor',
        'Supervisor',
        'Celular',
        'Pagamento',
        'Produto (código)',
        'Produto',
        'Tipo',
        'Quantidade',
        'Qtd em UN',
        'Preço UN',
        'Total item',
        'Total pedido',
      ],
    ];
    const num = (v: { toNumber(): number } | number) =>
      (typeof v === 'number' ? v : v.toNumber()).toLocaleString('pt-BR', {
        maximumFractionDigits: 3,
      });
    for (const p of pedidos) {
      for (const i of p.itens) {
        linhas.push([
          p.numero,
          formatarDataHora(p.criadoNoAppEm),
          STATUS_PEDIDO_LABEL[p.status],
          p.cliente.codigo,
          p.cliente.razaoSocial,
          formatarCpfCnpj(p.cliente.cpfCnpj),
          p.vendedor.nome,
          p.vendedor.supervisor?.nome ?? '',
          p.dispositivo.modelo ?? '',
          textoPagamento(p.formaPagamento, p.prazoDescricao),
          i.produto.codigo,
          i.produto.descricao,
          i.tipoEmbalagem,
          num(i.quantidade),
          num(i.qtdUnidades),
          num(i.precoUnitario),
          num(i.valorTotal),
          num(p.valorTotal),
        ]);
      }
    }
    const esc = (v: string | number) => {
      const s = String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // BOM + ";" para abrir corretamente no Excel em português
    const csv = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="pedidos-${hojeBrasilia()}.csv"`)
      .send(csv);
  });

  app.get('/pedidos/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const pedido = await prisma.pedido.findFirst({
      where: { AND: [{ id }, filtroVisibilidadePedidos(req.usuario)] },
      include: {
        cliente: true,
        vendedor: { include: { supervisor: { select: { id: true, nome: true } } } },
        dispositivo: true,
        avaliadoPor: { select: { id: true, nome: true } },
        canceladoPor: { select: { id: true, nome: true } },
        itens: {
          include: {
            produto: {
              select: {
                id: true,
                codigo: true,
                descricao: true,
                embalagem: true,
                qtdPorCaixa: true,
              },
            },
          },
          orderBy: { produto: { descricao: 'asc' } },
        },
      },
    });
    if (!pedido) throw naoEncontrado('Pedido');
    return pedido;
  });

  const avaliar = async (
    usuario: { id: string; perfil: string },
    id: string,
    dados: { status: 'APROVADO' | 'REPROVADO'; motivoReprovacao: string | null },
    where: ReturnType<typeof filtroVisibilidadePedidos>,
  ) => {
    const pedido = await prisma.pedido.findFirst({ where: { AND: [{ id }, where] } });
    if (!pedido) throw naoEncontrado('Pedido');
    // updateMany com condição de status evita corrida entre dois avaliadores
    const r = await prisma.pedido.updateMany({
      where: { id, status: 'PENDENTE' },
      data: { ...dados, avaliadoPorId: usuario.id, avaliadoEm: new Date() },
    });
    if (r.count === 0) throw new ErroHttp(409, 'Somente pedidos pendentes podem ser avaliados');
    return prisma.pedido.findUnique({ where: { id }, include: includeLista });
  };

  app.post(
    '/pedidos/:id/aprovar',
    { preHandler: [app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      return avaliar(
        req.usuario,
        id,
        { status: 'APROVADO', motivoReprovacao: null },
        filtroVisibilidadePedidos(req.usuario),
      );
    },
  );

  app.post(
    '/pedidos/:id/reprovar',
    { preHandler: [app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const { motivo } = reprovarSchema.parse(req.body);
      return avaliar(
        req.usuario,
        id,
        { status: 'REPROVADO', motivoReprovacao: motivo },
        filtroVisibilidadePedidos(req.usuario),
      );
    },
  );

  /** Cancela pedido pendente ou aprovado. O vendedor recebe o status no próximo sync. */
  app.post(
    '/pedidos/:id/cancelar',
    { preHandler: [app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const { motivo } = cancelarSchema.parse(req.body);
      const pedido = await prisma.pedido.findFirst({
        where: { AND: [{ id }, filtroVisibilidadePedidos(req.usuario)] },
      });
      if (!pedido) throw naoEncontrado('Pedido');
      // condição de status no próprio update evita corrida com aprovação/cancelamento simultâneos
      const r = await prisma.pedido.updateMany({
        where: { id, status: { in: ['PENDENTE', 'APROVADO'] } },
        data: {
          status: 'CANCELADO',
          motivoCancelamento: motivo,
          canceladoPorId: req.usuario.id,
          canceladoEm: new Date(),
        },
      });
      if (r.count === 0)
        throw new ErroHttp(409, 'Somente pedidos pendentes ou aprovados podem ser cancelados');
      return prisma.pedido.findUnique({ where: { id }, include: includeLista });
    },
  );
}
