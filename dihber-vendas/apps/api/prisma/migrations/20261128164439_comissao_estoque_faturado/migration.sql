-- AlterEnum
ALTER TYPE "StatusPedido" ADD VALUE 'FATURADO';

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "comissaoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ComissaoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valorBase" DECIMAL(12,2) NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valorComissao" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComissaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComissaoItem_pedidoItemId_key" ON "ComissaoItem"("pedidoItemId");

-- CreateIndex
CREATE INDEX "ComissaoItem_vendedorId_competencia_idx" ON "ComissaoItem"("vendedorId", "competencia");

-- CreateIndex
CREATE INDEX "ComissaoItem_competencia_idx" ON "ComissaoItem"("competencia");

-- AddForeignKey
ALTER TABLE "ComissaoItem" ADD CONSTRAINT "ComissaoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoItem" ADD CONSTRAINT "ComissaoItem_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoItem" ADD CONSTRAINT "ComissaoItem_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoItem" ADD CONSTRAINT "ComissaoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pedidos já existentes também entram na tabela de comissões (0%: os produtos ainda não tinham
-- comissão), para o faturamento deles aparecer no relatório quando forem faturados.
INSERT INTO "ComissaoItem" ("id", "pedidoId", "pedidoItemId", "vendedorId", "produtoId", "competencia", "valorBase", "percentual", "valorComissao")
SELECT gen_random_uuid()::text, p."id", i."id", p."vendedorId", i."produtoId",
       to_char((p."criadoNoAppEm" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
       i."valorTotal", 0, 0
FROM "PedidoItem" i JOIN "Pedido" p ON p."id" = i."pedidoId"
ON CONFLICT DO NOTHING;
