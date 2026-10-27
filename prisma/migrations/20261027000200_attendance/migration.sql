BEGIN;

-- CreateEnum
CREATE TYPE "status_registro" AS ENUM ('rascunho', 'enviado', 'devolvido', 'cancelado');

-- CreateTable
CREATE TABLE "ficha_estagio" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "vinculo_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ficha_estagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_estagio" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "ficha_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "inicio_minuto" INTEGER NOT NULL,
    "fim_minuto" INTEGER NOT NULL,
    "duracao_minutos" INTEGER NOT NULL,
    "atividades" VARCHAR(4000) NOT NULL,
    "status" "status_registro" NOT NULL DEFAULT 'rascunho',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registro_estagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_registro" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "registro_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "acao" VARCHAR(20) NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivo" VARCHAR(1000),
    "snapshot" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_registro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ficha_estagio_vinculo_id_key" ON "ficha_estagio"("vinculo_id");

-- CreateIndex
CREATE INDEX "ficha_estagio_instituicao_id_aluno_id_idx" ON "ficha_estagio"("instituicao_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_estagio_id_instituicao_id_aluno_id_key" ON "ficha_estagio"("id", "instituicao_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_estagio_vinculo_id_instituicao_id_aluno_id_key" ON "ficha_estagio"("vinculo_id", "instituicao_id", "aluno_id");

-- CreateIndex
CREATE INDEX "registro_estagio_aluno_id_data_idx" ON "registro_estagio"("aluno_id", "data");

-- CreateIndex
CREATE INDEX "registro_estagio_ficha_id_status_idx" ON "registro_estagio"("ficha_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "registro_estagio_id_instituicao_id_key" ON "registro_estagio"("id", "instituicao_id");

-- CreateIndex
CREATE INDEX "evento_registro_instituicao_id_autor_id_idx" ON "evento_registro"("instituicao_id", "autor_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_registro_registro_id_versao_key" ON "evento_registro"("registro_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_estagio_id_instituicao_id_aluno_id_key" ON "vinculo_estagio"("id", "instituicao_id", "aluno_id");

-- AddForeignKey
ALTER TABLE "ficha_estagio" ADD CONSTRAINT "ficha_estagio_vinculo_id_instituicao_id_aluno_id_fkey" FOREIGN KEY ("vinculo_id", "instituicao_id", "aluno_id") REFERENCES "vinculo_estagio"("id", "instituicao_id", "aluno_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_estagio" ADD CONSTRAINT "registro_estagio_ficha_id_instituicao_id_aluno_id_fkey" FOREIGN KEY ("ficha_id", "instituicao_id", "aluno_id") REFERENCES "ficha_estagio"("id", "instituicao_id", "aluno_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_registro" ADD CONSTRAINT "evento_registro_registro_id_instituicao_id_fkey" FOREIGN KEY ("registro_id", "instituicao_id") REFERENCES "registro_estagio"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_registro" ADD CONSTRAINT "evento_registro_autor_id_instituicao_id_fkey" FOREIGN KEY ("autor_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registro_estagio" ADD CONSTRAINT "registro_horario_valido"
  CHECK (inicio_minuto >= 0 AND fim_minuto < 1440 AND fim_minuto > inicio_minuto
    AND duracao_minutos = fim_minuto - inicio_minuto);
ALTER TABLE "registro_estagio" ADD CONSTRAINT "registro_versao_positiva" CHECK (versao > 0);
ALTER TABLE "registro_estagio" ADD CONSTRAINT "registro_atividade_preenchida" CHECK (length(btrim(atividades)) > 0);
ALTER TABLE "evento_registro" ADD CONSTRAINT "evento_acao_valida"
  CHECK (acao IN ('criado', 'editado', 'enviado', 'devolvido', 'cancelado') AND versao > 0
    AND (acao <> 'devolvido' OR length(btrim(motivo)) > 0 AND motivo IS NOT NULL));

-- Preserve previous revisions, including return reasons and the original content.
CREATE FUNCTION impedir_alteracao_evento_registro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de registros não pode ser alterado ou excluído.';
END;
$$;
CREATE TRIGGER evento_registro_imutavel BEFORE UPDATE OR DELETE ON evento_registro
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_evento_registro();

ALTER TABLE "ficha_estagio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registro_estagio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento_registro" ENABLE ROW LEVEL SECURITY;

COMMIT;
