BEGIN;

-- AlterEnum
ALTER TYPE "status_registro" ADD VALUE 'aprovado';

-- CreateTable
CREATE TABLE "aprovacao_registro" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "registro_id" UUID NOT NULL,
    "professora_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovacao_registro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reabertura_aprovacao" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "aprovacao_id" UUID NOT NULL,
    "professora_id" UUID NOT NULL,
    "motivo" VARCHAR(1000) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reabertura_aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aprovacao_registro_instituicao_id_professora_id_idx" ON "aprovacao_registro"("instituicao_id", "professora_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacao_registro_id_instituicao_id_key" ON "aprovacao_registro"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacao_registro_registro_id_versao_key" ON "aprovacao_registro"("registro_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "reabertura_aprovacao_aprovacao_id_key" ON "reabertura_aprovacao"("aprovacao_id");

-- CreateIndex
CREATE INDEX "reabertura_aprovacao_instituicao_id_professora_id_idx" ON "reabertura_aprovacao"("instituicao_id", "professora_id");

-- CreateIndex
CREATE UNIQUE INDEX "reabertura_aprovacao_aprovacao_id_instituicao_id_key" ON "reabertura_aprovacao"("aprovacao_id", "instituicao_id");

-- AddForeignKey
ALTER TABLE "aprovacao_registro" ADD CONSTRAINT "aprovacao_registro_registro_id_instituicao_id_fkey" FOREIGN KEY ("registro_id", "instituicao_id") REFERENCES "registro_estagio"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacao_registro" ADD CONSTRAINT "aprovacao_registro_professora_id_instituicao_id_fkey" FOREIGN KEY ("professora_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reabertura_aprovacao" ADD CONSTRAINT "reabertura_aprovacao_aprovacao_id_instituicao_id_fkey" FOREIGN KEY ("aprovacao_id", "instituicao_id") REFERENCES "aprovacao_registro"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reabertura_aprovacao" ADD CONSTRAINT "reabertura_aprovacao_professora_id_instituicao_id_fkey" FOREIGN KEY ("professora_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evento_registro" DROP CONSTRAINT "evento_acao_valida";
ALTER TABLE "evento_registro" ADD CONSTRAINT "evento_acao_valida"
  CHECK (acao IN ('criado', 'editado', 'enviado', 'devolvido', 'cancelado', 'aprovado', 'reaberto') AND versao > 0
    AND (acao NOT IN ('devolvido', 'reaberto') OR (motivo IS NOT NULL AND length(btrim(motivo)) > 0)));
ALTER TABLE "aprovacao_registro" ADD CONSTRAINT "aprovacao_versao_valida" CHECK (versao > 0);
ALTER TABLE "reabertura_aprovacao" ADD CONSTRAINT "reabertura_motivo_preenchido" CHECK (length(btrim(motivo)) > 0);

-- Reopenings are separate immutable rows; the original approval is never overwritten.
CREATE TRIGGER aprovacao_registro_imutavel BEFORE UPDATE OR DELETE ON "aprovacao_registro"
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_evento_registro();
CREATE TRIGGER reabertura_aprovacao_imutavel BEFORE UPDATE OR DELETE ON "reabertura_aprovacao"
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_evento_registro();
ALTER TABLE "aprovacao_registro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reabertura_aprovacao" ENABLE ROW LEVEL SECURITY;

COMMIT;
