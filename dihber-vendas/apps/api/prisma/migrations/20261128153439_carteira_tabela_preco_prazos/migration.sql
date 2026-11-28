-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'BOLETO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "tabelaPrecoId" TEXT;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "formaPagamento" "FormaPagamento",
ADD COLUMN     "prazoDescricao" TEXT,
ADD COLUMN     "prazoPagamentoId" TEXT;

-- CreateTable
CREATE TABLE "ClienteVendedor" (
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteVendedor_pkey" PRIMARY KEY ("clienteId","vendedorId")
);

-- CreateTable
CREATE TABLE "TabelaPreco" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "uf" CHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaPrecoItem" (
    "id" TEXT NOT NULL,
    "tabelaPrecoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "preco" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaPrecoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrazoPagamento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrazoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientePrazo" (
    "clienteId" TEXT NOT NULL,
    "prazoId" TEXT NOT NULL,

    CONSTRAINT "ClientePrazo_pkey" PRIMARY KEY ("clienteId","prazoId")
);

-- CreateIndex
CREATE INDEX "ClienteVendedor_vendedorId_idx" ON "ClienteVendedor"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "TabelaPreco_codigo_key" ON "TabelaPreco"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TabelaPrecoItem_tabelaPrecoId_produtoId_key" ON "TabelaPrecoItem"("tabelaPrecoId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrazoPagamento_codigo_key" ON "PrazoPagamento"("codigo");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tabelaPrecoId_fkey" FOREIGN KEY ("tabelaPrecoId") REFERENCES "TabelaPreco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_prazoPagamentoId_fkey" FOREIGN KEY ("prazoPagamentoId") REFERENCES "PrazoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteVendedor" ADD CONSTRAINT "ClienteVendedor_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteVendedor" ADD CONSTRAINT "ClienteVendedor_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabelaPrecoItem" ADD CONSTRAINT "TabelaPrecoItem_tabelaPrecoId_fkey" FOREIGN KEY ("tabelaPrecoId") REFERENCES "TabelaPreco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabelaPrecoItem" ADD CONSTRAINT "TabelaPrecoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePrazo" ADD CONSTRAINT "ClientePrazo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePrazo" ADD CONSTRAINT "ClientePrazo_prazoId_fkey" FOREIGN KEY ("prazoId") REFERENCES "PrazoPagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mantém o comportamento anterior: até agora todo vendedor via todos os clientes.
-- Por isso os clientes já existentes ficam vinculados a todos os vendedores já existentes;
-- depois ajuste a carteira de cada um no portal.
INSERT INTO "ClienteVendedor" ("clienteId", "vendedorId")
SELECT c."id", v."id" FROM "Cliente" c CROSS JOIN "Vendedor" v
ON CONFLICT DO NOTHING;
