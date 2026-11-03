BEGIN;
-- AlterTable
ALTER TABLE "registro_estagio" ADD COLUMN     "sessao_id" UUID;

-- CreateTable
CREATE TABLE "agenda_sessao" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "estagio_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "inicio_minuto" INTEGER NOT NULL,
    "fim_minuto" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencia_sessao" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "estagio_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "vinculo_id" UUID NOT NULL,
    "situacao" VARCHAR(20) NOT NULL,
    "motivo" VARCHAR(1000),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "professora_id" UUID NOT NULL,

    CONSTRAINT "frequencia_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_agenda" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "acao" VARCHAR(30) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_sessao_instituicao_id_data_idx" ON "agenda_sessao"("instituicao_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_sessao_id_instituicao_id_key" ON "agenda_sessao"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_sessao_id_instituicao_id_estagio_id_key" ON "agenda_sessao"("id", "instituicao_id", "estagio_id");

-- CreateIndex
CREATE UNIQUE INDEX "frequencia_sessao_id_instituicao_id_key" ON "frequencia_sessao"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "frequencia_sessao_sessao_id_vinculo_id_key" ON "frequencia_sessao"("sessao_id", "vinculo_id");

-- CreateIndex
CREATE INDEX "evento_agenda_sessao_id_criado_em_idx" ON "evento_agenda"("sessao_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "estagio_id_instituicao_id_key" ON "estagio"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_estagio_id_instituicao_id_key" ON "vinculo_estagio"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_estagio_id_instituicao_id_estagio_id_key" ON "vinculo_estagio"("id", "instituicao_id", "estagio_id");

-- AddForeignKey
ALTER TABLE "registro_estagio" ADD CONSTRAINT "registro_estagio_sessao_id_instituicao_id_fkey" FOREIGN KEY ("sessao_id", "instituicao_id") REFERENCES "agenda_sessao"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_sessao" ADD CONSTRAINT "agenda_sessao_estagio_id_instituicao_id_fkey" FOREIGN KEY ("estagio_id", "instituicao_id") REFERENCES "estagio"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_sessao" ADD CONSTRAINT "agenda_sessao_criado_por_id_instituicao_id_fkey" FOREIGN KEY ("criado_por_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_sessao" ADD CONSTRAINT "frequencia_sessao_sessao_id_instituicao_id_estagio_id_fkey" FOREIGN KEY ("sessao_id", "instituicao_id", "estagio_id") REFERENCES "agenda_sessao"("id", "instituicao_id", "estagio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_sessao" ADD CONSTRAINT "frequencia_sessao_vinculo_id_instituicao_id_estagio_id_fkey" FOREIGN KEY ("vinculo_id", "instituicao_id", "estagio_id") REFERENCES "vinculo_estagio"("id", "instituicao_id", "estagio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_sessao" ADD CONSTRAINT "frequencia_sessao_professora_id_instituicao_id_fkey" FOREIGN KEY ("professora_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_agenda" ADD CONSTRAINT "evento_agenda_sessao_id_instituicao_id_fkey" FOREIGN KEY ("sessao_id", "instituicao_id") REFERENCES "agenda_sessao"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_agenda" ADD CONSTRAINT "evento_agenda_autor_id_instituicao_id_fkey" FOREIGN KEY ("autor_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE agenda_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencia_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_sessao ADD CONSTRAINT agenda_horario CHECK (inicio_minuto >= 0 AND fim_minuto <= 1439 AND fim_minuto > inicio_minuto AND versao > 0);
ALTER TABLE frequencia_sessao ADD CONSTRAINT frequencia_situacao CHECK (situacao IN ('presente', 'falta', 'justificada') AND versao > 0 AND (situacao <> 'justificada' OR (motivo IS NOT NULL AND length(trim(motivo)) > 0)));
CREATE UNIQUE INDEX registro_sessao_ativo ON registro_estagio(sessao_id, aluno_id) WHERE sessao_id IS NOT NULL AND status <> 'cancelado';
CREATE FUNCTION proteger_evento_agenda() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Histórico da agenda é imutável'; END; $$;
CREATE TRIGGER evento_agenda_imutavel BEFORE UPDATE OR DELETE ON evento_agenda FOR EACH ROW EXECUTE FUNCTION proteger_evento_agenda();
COMMIT;
