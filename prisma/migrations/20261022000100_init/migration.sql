BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "perfil" AS ENUM ('aluno', 'professora', 'coordenacao');

-- CreateTable
CREATE TABLE "instituicao" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "perfil" NOT NULL,
    "coren" VARCHAR(30),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "turma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_instituicao_id_idx" ON "usuario"("instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_instituicao_id_codigo_key" ON "turma"("instituicao_id", "codigo");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Deny access through the automatic Data API until explicit policies exist.
ALTER TABLE "instituicao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "turma" ENABLE ROW LEVEL SECURITY;

COMMIT;
