import type { FastifyInstance } from 'fastify';
import {
  clienteSchema,
  prazoPagamentoSchema,
  tabelaPrecoSchema,
  produtoSchema,
  somenteDigitos,
  supervisorSchema,
  vendedorSchema,
} from '@dihber/shared';
import { registrarCrud } from './crud';
import { registrarRotasItensTabela } from './tabela-preco-itens';
import { Prisma, prisma } from '../../lib/prisma';
import { disponivel, reservadoPorProduto, STATUS_RESERVA } from '../../lib/estoque';
import { filtroVisibilidadePedidos } from '../../lib/visibilidade';
import { ErroHttp } from '../../lib/erros';
import { z } from 'zod';

export async function rotasCadastros(app: FastifyInstance) {
  registrarCrud(app, {
    rota: '/supervisores',
    modelo: 'supervisor',
    nomeExibicao: 'Supervisor',
    schema: supervisorSchema,
    camposBusca: ['codigo', 'nome', 'email'],
    ordenarPor: 'nome',
    include: { _count: { select: { vendedores: true } } },
    includeDetalhe: {
      vendedores: {
        select: { id: true, codigo: true, nome: true, ativo: true },
        orderBy: { nome: 'asc' },
      },
      usuario: { select: { id: true, login: true, nome: true } },
    },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    filtroLeitura: (req) =>
      req.usuario.perfil === 'SUPERVISOR' ? { id: req.usuario.supervisorId ?? '-' } : {},
  });

  registrarCrud(app, {
    rota: '/vendedores',
    modelo: 'vendedor',
    nomeExibicao: 'Vendedor',
    schema: vendedorSchema,
    camposBusca: ['codigo', 'nome', 'email'],
    ordenarPor: 'nome',
    include: {
      supervisor: { select: { id: true, codigo: true, nome: true } },
      usuario: { select: { id: true, login: true } },
    },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    // supervisor só enxerga os vendedores da própria equipe
    filtroLeitura: (req) =>
      req.usuario.perfil === 'SUPERVISOR' ? { supervisorId: req.usuario.supervisorId ?? '-' } : {},
    filtrosExtras: (q) =>
      typeof q.supervisorId === 'string' && q.supervisorId ? { supervisorId: q.supervisorId } : {},
  });

  registrarCrud(app, {
    rota: '/clientes',
    modelo: 'cliente',
    nomeExibicao: 'Cliente',
    schema: clienteSchema,
    camposBusca: ['codigo', 'razaoSocial', 'nomeFantasia', 'cidade'],
    ordenarPor: 'razaoSocial',
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    include: {
      tabelaPreco: { select: { id: true, codigo: true, nome: true } },
      vendedores: {
        select: { vendedor: { select: { id: true, codigo: true, nome: true } } },
        orderBy: { vendedor: { nome: 'asc' } },
      },
      prazos: {
        select: { prazo: { select: { id: true, codigo: true, descricao: true, ativo: true } } },
        orderBy: { prazo: { descricao: 'asc' } },
      },
    },
    filtrosExtras: (q) =>
      typeof q.vendedorId === 'string' && q.vendedorId
        ? { vendedores: { some: { vendedorId: q.vendedorId } } }
        : {},
    paraDados: (dados, editando) => {
      const { vendedorIds, prazoIds, ...resto } = dados as {
        vendedorIds: string[];
        prazoIds: string[];
      } & Record<string, unknown>;
      return {
        ...resto,
        // a data muda mesmo quando só os vínculos mudam, para o sync do app enxergar
        ...(editando ? { updatedAt: new Date() } : {}),
        vendedores: {
          ...(editando ? { deleteMany: {} } : {}),
          create: vendedorIds.map((vendedorId) => ({ vendedorId })),
        },
        prazos: {
          ...(editando ? { deleteMany: {} } : {}),
          create: prazoIds.map((prazoId) => ({ prazoId })),
        },
      };
    },
    montarBusca: (busca) => {
      const digitos = somenteDigitos(busca);
      return {
        OR: [
          ...['codigo', 'razaoSocial', 'nomeFantasia', 'cidade'].map((c) => ({
            [c]: { contains: busca, mode: 'insensitive' },
          })),
          ...(digitos.length >= 3 ? [{ cpfCnpj: { contains: digitos } }] : []),
        ],
      };
    },
  });

  registrarCrud(app, {
    rota: '/produtos',
    modelo: 'produto',
    nomeExibicao: 'Produto',
    schema: produtoSchema,
    camposBusca: ['codigo', 'descricao'],
    ordenarPor: 'descricao',
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    // saldo: total, reservado (pedidos pendentes/aprovados) e disponível
    completar: async (produtos) => {
      const reservado = await reservadoPorProduto(produtos.map((p) => p.id as string));
      return produtos.map((p) => {
        const r = reservado.get(p.id as string) ?? 0;
        return {
          ...p,
          estoqueReservado: r,
          estoqueDisponivel: disponivel(p.estoque as Prisma.Decimal | null, r),
        };
      });
    },
  });

  /** Pedidos que estão reservando o estoque de um produto. */
  app.get(
    '/produtos/:id/reservas',
    { preHandler: [app.autenticar, app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid('ID inválido') }).parse(req.params);
      const produto = await prisma.produto.findUnique({
        where: { id },
        select: { id: true, codigo: true, descricao: true, estoque: true },
      });
      if (!produto) throw new ErroHttp(404, 'Produto não encontrado');
      const reservado = (await reservadoPorProduto([id])).get(id) ?? 0;
      const itens = await prisma.pedidoItem.findMany({
        where: {
          produtoId: id,
          pedido: {
            status: { in: [...STATUS_RESERVA] },
            ...filtroVisibilidadePedidos(req.usuario),
          },
        },
        select: {
          tipoEmbalagem: true,
          quantidade: true,
          qtdUnidades: true,
          pedido: {
            select: {
              id: true,
              numero: true,
              status: true,
              criadoNoAppEm: true,
              cliente: { select: { codigo: true, razaoSocial: true, nomeFantasia: true } },
              vendedor: { select: { nome: true } },
            },
          },
        },
        orderBy: { pedido: { numero: 'desc' } },
      });
      return {
        produto: { ...produto },
        estoque: produto.estoque,
        reservado,
        disponivel: disponivel(produto.estoque, reservado),
        pedidos: itens,
      };
    },
  );

  registrarCrud(app, {
    rota: '/tabelas-preco',
    modelo: 'tabelaPreco',
    nomeExibicao: 'Tabela de preço',
    schema: tabelaPrecoSchema,
    camposBusca: ['codigo', 'nome', 'cidade', 'uf'],
    ordenarPor: 'nome',
    include: { _count: { select: { itens: true, clientes: true } } },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
  });

  registrarCrud(app, {
    rota: '/prazos',
    modelo: 'prazoPagamento',
    nomeExibicao: 'Prazo de pagamento',
    schema: prazoPagamentoSchema,
    camposBusca: ['codigo', 'descricao'],
    ordenarPor: 'descricao',
    include: { _count: { select: { clientes: true } } },
    perfisLeitura: ['ADMIN', 'SUPERVISOR'],
    // o prazo vai junto com o cliente para o app: marca os clientes dele para o próximo sync
    aposSalvar: async ({ id }) => {
      await prisma.cliente.updateMany({
        where: { prazos: { some: { prazoId: id } } },
        data: { updatedAt: new Date() },
      });
    },
  });

  registrarRotasItensTabela(app);
}
