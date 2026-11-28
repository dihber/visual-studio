-- CreateEnum
CREATE TYPE "StatusBuildApp" AS ENUM ('NA_FILA', 'GERANDO', 'CONCLUIDO', 'FALHOU');

-- CreateTable
CREATE TABLE "AppBuild" (
    "id" TEXT NOT NULL,
    "status" "StatusBuildApp" NOT NULL DEFAULT 'NA_FILA',
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "versao" TEXT,
    "easBuildId" TEXT,
    "urlDownload" TEXT,
    "githubRunId" TEXT,
    "githubRunUrl" TEXT,
    "erro" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppBuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppBuild_solicitadoEm_idx" ON "AppBuild"("solicitadoEm");

-- AddForeignKey
ALTER TABLE "AppBuild" ADD CONSTRAINT "AppBuild_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
