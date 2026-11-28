import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tabelaPrecoItensSchema } from '@dihber/shared';
import { Prisma, prisma } from '../../lib/prisma';
import { ErroHttp, naoEncontrado } from '../../lib/erros';

const idParams = z.object({ id: z.string().uuid('ID inválido') });

/** Preços por produto de uma tabela (produto sem preço na tabela usa o preço base). */
export function registrarRotasItensTabela(app: FastifyInstance) {
  app.get(
    '/tabelas-preco/:id/itens',
    { preHandler: [app.autenticar, app.exigirPerfil('ADMIN', 'SUPERVISOR')] },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const tabela = await prisma.tabelaPreco.findUnique({ where: { id } });
      if (!tabela) throw naoEncontrado('Tabela de preço');
      const [produtos, itens] = await Promise.all([
        prisma.produto.findMany({
          where: { ativo: true },
          select: { id: true, codigo: true, descricao: true, embalagem: true, precoUnitario: true },
          orderBy: { descricao: 'asc' },
        }),
        prisma.tabelaPrecoItem.findMany({
          where: { tabelaPrecoId: id },
          select: { produtoId: true, preco: true },
        }),
      ]);
      const precos = new Map(itens.map((i) => [i.produtoId, i.preco]));
      return produtos.map((p) => ({
        produtoId: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        embalagem: p.embalagem,
        precoBase: p.precoUnitario,
        preco: precos.get(p.id) ?? null,
      }));
    },
  );

  app.put(
    '/tabelas-preco/:id/itens',
    { preHandler: [app.autenticar, app.exigirPerfil('ADMIN')], bodyLimit: 5 * 1024 * 1024 },
    async (req) => {
      const { id } = idParams.parse(req.params);
      const { itens } = tabelaPrecoItensSchema.parse(req.body);
      const tabela = await prisma.tabelaPreco.findUnique({ where: { id } });
      if (!tabela) throw naoEncontrado('Tabela de preço');

      const comPreco = itens.filter((i) => i.preco !== null);
      const semPreco = itens.filter((i) => i.preco === null).map((i) => i.produtoId);
      if (comPreco.length) {
        const existentes = await prisma.produto.count({
          where: { id: { in: comPreco.map((i) => i.produtoId) } },
        });
        if (existentes !== new Set(comPreco.map((i) => i.produtoId)).size)
          throw new ErroHttp(400, 'Produto não encontrado');
      }

      await prisma.$transaction([
        prisma.tabelaPrecoItem.deleteMany({
          where: { tabelaPrecoId: id, produtoId: { in: semPreco } },
        }),
        ...comPreco.map((i) =>
          prisma.tabelaPrecoItem.upsert({
            where: { tabelaPrecoId_produtoId: { tabelaPrecoId: id, produtoId: i.produtoId } },
            create: {
              tabelaPrecoId: id,
              produtoId: i.produtoId,
              preco: new Prisma.Decimal(i.preco!.toFixed(2)),
            },
            update: { preco: new Prisma.Decimal(i.preco!.toFixed(2)) },
          }),
        ),
        // a tabela inteira é reenviada aos celulares no próximo sync
        prisma.tabelaPreco.update({ where: { id }, data: { updatedAt: new Date() } }),
      ]);
      const total = await prisma.tabelaPrecoItem.count({ where: { tabelaPrecoId: id } });
      return { ok: true, itens: total };
    },
  );
}
