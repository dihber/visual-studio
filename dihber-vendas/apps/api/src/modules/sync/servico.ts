import {
  calcularItem,
  calcularTotalPedido,
  pedidoSyncSchema,
  type ClienteSync,
  type ProdutoSync,
  type SyncDadosResposta,
  type SyncPedidosResposta,
  type TabelaPrecoSync,
} from '@dihber/shared';
import { Prisma, prisma } from '../../lib/prisma';

class ErroPedido extends Error {}

/**
 * Recebe um lote de pedidos do app. Idempotente: se o id (UUID gerado no app) já existe
 * para o mesmo vendedor, apenas confirma o número. O servidor recalcula todos os valores.
 */
export async function receberPedidos(
  vendedorId: string,
  dispositivoId: string,
  pedidosBrutos: unknown[],
): Promise<SyncPedidosResposta> {
  const resposta: SyncPedidosResposta = { aceitos: [], rejeitados: [] };

  for (const bruto of pedidosBrutos) {
    const parse = pedidoSyncSchema.safeParse(bruto);
    const idBruto =
      bruto && typeof bruto === 'object' && typeof (bruto as { id?: unknown }).id === 'string'
        ? (bruto as { id: string }).id
        : null;
    if (!parse.success) {
      resposta.rejeitados.push({
        id: idBruto,
        erro: parse.error.issues[0]?.message ?? 'Pedido inválido',
      });
      continue;
    }
    const p = parse.data;
    try {
      const existente = await prisma.pedido.findUnique({ where: { id: p.id } });
      if (existente) {
        if (existente.vendedorId !== vendedorId)
          throw new ErroPedido('Identificador de pedido já utilizado');
        resposta.aceitos.push({ id: p.id, numero: existente.numero });
        continue;
      }

      const cliente = await prisma.cliente.findUnique({
        where: { id: p.clienteId },
        include: {
          vendedores: { where: { vendedorId }, select: { vendedorId: true } },
          tabelaPreco: true,
        },
      });
      if (!cliente) throw new ErroPedido('Cliente não encontrado');
      if (!cliente.ativo) throw new ErroPedido(`Cliente inativo: ${cliente.razaoSocial}`);
      if (cliente.vendedores.length === 0)
        throw new ErroPedido(`Cliente fora da sua carteira: ${cliente.razaoSocial}`);

      // forma de pagamento: PIX sempre; boleto só com prazo vinculado ao cliente
      let prazoDescricao: string | null = null;
      if (p.formaPagamento === 'BOLETO') {
        const vinculo = await prisma.clientePrazo.findUnique({
          where: { clienteId_prazoId: { clienteId: cliente.id, prazoId: p.prazoPagamentoId! } },
          include: { prazo: true },
        });
        if (!vinculo || !vinculo.prazo.ativo)
          throw new ErroPedido(`Prazo de pagamento não permitido para ${cliente.razaoSocial}`);
        prazoDescricao = vinculo.prazo.descricao;
      }

      const idsProdutos = [...new Set(p.itens.map((i) => i.produtoId))];
      const produtos = await prisma.produto.findMany({ where: { id: { in: idsProdutos } } });
      const porId = new Map(produtos.map((x) => [x.id, x]));
      // preço da tabela do cliente (se ativa); produto fora da tabela usa o preço base
      const precosTabela = new Map<string, number>();
      if (cliente.tabelaPreco?.ativo) {
        const itensTabela = await prisma.tabelaPrecoItem.findMany({
          where: { tabelaPrecoId: cliente.tabelaPreco.id, produtoId: { in: idsProdutos } },
        });
        for (const it of itensTabela) precosTabela.set(it.produtoId, it.preco.toNumber());
      }

      const itens = p.itens.map((i) => {
        const prod = porId.get(i.produtoId);
        if (!prod) throw new ErroPedido('Produto não encontrado');
        if (!prod.ativo)
          throw new ErroPedido(`Produto inativo: ${prod.codigo} - ${prod.descricao}`);
        const preco = precosTabela.get(prod.id) ?? prod.precoUnitario.toNumber();
        const calc = calcularItem({
          tipoEmbalagem: i.tipoEmbalagem,
          quantidade: i.quantidade,
          qtdPorCaixa: prod.qtdPorCaixa,
          precoUnitario: preco,
        });
        return {
          produtoId: prod.id,
          tipoEmbalagem: i.tipoEmbalagem,
          quantidade: new Prisma.Decimal(i.quantidade.toFixed(3)),
          qtdUnidades: new Prisma.Decimal(calc.qtdUnidades.toFixed(3)),
          precoUnitario: new Prisma.Decimal(preco.toFixed(2)),
          valorTotal: new Prisma.Decimal(calc.valorTotal.toFixed(2)),
          _valor: calc.valorTotal,
        };
      });
      const total = calcularTotalPedido(itens.map((i) => ({ valorTotal: i._valor })));

      const criado = await prisma.pedido.create({
        data: {
          id: p.id,
          vendedorId,
          clienteId: cliente.id,
          dispositivoId,
          observacao: p.observacao?.trim() || null,
          criadoNoAppEm: new Date(p.criadoNoAppEm),
          valorTotal: new Prisma.Decimal(total.toFixed(2)),
          formaPagamento: p.formaPagamento ?? null,
          prazoPagamentoId: p.formaPagamento === 'BOLETO' ? p.prazoPagamentoId : null,
          prazoDescricao,
          itens: { create: itens.map(({ _valor, ...i }) => i) },
        },
        select: { id: true, numero: true },
      });
      resposta.aceitos.push(criado);
    } catch (e) {
      // reenvio concorrente do mesmo pedido: confirma o já gravado
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const ja = await prisma.pedido.findUnique({ where: { id: p.id } });
        if (ja && ja.vendedorId === vendedorId) {
          resposta.aceitos.push({ id: ja.id, numero: ja.numero });
          continue;
        }
      }
      if (e instanceof ErroPedido) {
        resposta.rejeitados.push({ id: p.id, erro: e.message });
        continue;
      }
      throw e;
    }
  }
  return resposta;
}

/**
 * Sincronização incremental (delta): devolve registros com updatedAt >= desde.
 * Sem "desde" (primeiro login) faz carga completa, apenas de registros ativos.
 * Clientes: só os da carteira do vendedor; os que saíram dela vão em clientesRemovidos.
 */
export async function montarDados(vendedorId: string, desde?: string): Promise<SyncDadosResposta> {
  // capturado ANTES das consultas para não perder alterações feitas durante o sync
  const servidorAgora = new Date();
  const desdeData = desde ? new Date(desde) : null;
  const filtro = desdeData ? { updatedAt: { gte: desdeData } } : { ativo: true };

  const [clientes, produtos, pedidos] = await Promise.all([
    prisma.cliente.findMany({
      where: desdeData
        ? { updatedAt: { gte: desdeData } }
        : { ativo: true, vendedores: { some: { vendedorId } } },
      include: {
        vendedores: { where: { vendedorId }, select: { vendedorId: true } },
        prazos: {
          where: { prazo: { ativo: true } },
          select: { prazo: { select: { id: true, descricao: true } } },
          orderBy: { prazo: { descricao: 'asc' } },
        },
      },
      orderBy: { razaoSocial: 'asc' },
    }),
    prisma.produto.findMany({ where: filtro, orderBy: { descricao: 'asc' } }),
    prisma.pedido.findMany({
      where: { vendedorId, ...(desdeData ? { updatedAt: { gte: desdeData } } : {}) },
      select: {
        id: true,
        numero: true,
        status: true,
        motivoReprovacao: true,
        motivoCancelamento: true,
      },
      orderBy: { numero: 'desc' },
      take: desdeData ? undefined : 500,
    }),
  ]);

  const naCarteira = clientes.filter((c) => c.vendedores.length > 0);
  const clientesRemovidos = clientes.filter((c) => c.vendedores.length === 0).map((c) => c.id);

  // tabelas de preço: as dos clientes enviados agora + as alteradas desde o último sync
  // que pertencem a algum cliente da carteira
  const idsTabelas = new Set(
    naCarteira.map((c) => c.tabelaPrecoId).filter((x): x is string => !!x),
  );
  if (desdeData) {
    const alteradas = await prisma.tabelaPreco.findMany({
      where: {
        updatedAt: { gte: desdeData },
        clientes: { some: { vendedores: { some: { vendedorId } } } },
      },
      select: { id: true },
    });
    for (const t of alteradas) idsTabelas.add(t.id);
  }
  const tabelas = idsTabelas.size
    ? await prisma.tabelaPreco.findMany({
        where: { id: { in: [...idsTabelas] } },
        include: { itens: { select: { produtoId: true, preco: true } } },
      })
    : [];

  return {
    servidorAgora: servidorAgora.toISOString(),
    clientes: naCarteira.map((c): ClienteSync => ({
      id: c.id,
      codigo: c.codigo,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cpfCnpj: c.cpfCnpj,
      telefone: c.telefone,
      cidade: c.cidade,
      uf: c.uf,
      ativo: c.ativo,
      tabelaPrecoId: c.tabelaPrecoId,
      prazos: c.prazos.map((x) => x.prazo),
      updatedAt: c.updatedAt.toISOString(),
    })),
    clientesRemovidos,
    produtos: produtos.map((x): ProdutoSync => ({
      id: x.id,
      codigo: x.codigo,
      descricao: x.descricao,
      embalagem: x.embalagem,
      qtdPorCaixa: x.qtdPorCaixa,
      precoUnitario: x.precoUnitario.toNumber(),
      estoque: x.estoque?.toNumber() ?? null,
      ativo: x.ativo,
      updatedAt: x.updatedAt.toISOString(),
    })),
    tabelasPreco: tabelas.map((t): TabelaPrecoSync => ({
      id: t.id,
      ativo: t.ativo,
      itens: t.itens.map((i) => ({ produtoId: i.produtoId, preco: i.preco.toNumber() })),
    })),
    statusPedidos: pedidos,
  };
}
