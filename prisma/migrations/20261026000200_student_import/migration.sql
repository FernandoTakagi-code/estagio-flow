BEGIN;

-- CreateTable
CREATE TABLE "importacao_alunos" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "dados" JSONB,
    "quantidade" INTEGER NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "confirmada_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacao_alunos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "importacao_alunos_instituicao_id_criado_por_id_idx" ON "importacao_alunos"("instituicao_id", "criado_por_id");

-- CreateIndex
CREATE INDEX "importacao_alunos_expira_em_idx" ON "importacao_alunos"("expira_em");

-- AddForeignKey
ALTER TABLE "importacao_alunos" ADD CONSTRAINT "importacao_alunos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao_alunos" ADD CONSTRAINT "importacao_alunos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "importacao_alunos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "importacao_alunos" ADD CONSTRAINT "importacao_alunos_quantidade" CHECK ("quantidade" BETWEEN 1 AND 100);

COMMIT;
