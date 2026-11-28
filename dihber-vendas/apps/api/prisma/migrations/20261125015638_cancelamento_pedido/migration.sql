-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPorId" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
