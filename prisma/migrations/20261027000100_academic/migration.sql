BEGIN;

-- CreateTable
CREATE TABLE "disciplina" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "carga_horaria_total" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campo_estagio" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campo_estagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matricula_turma" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrado_em" TIMESTAMPTZ(3),

    CONSTRAINT "matricula_turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estagio" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "campo_estagio_id" UUID NOT NULL,
    "professora_id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "encerrado_em" TIMESTAMPTZ(3),

    CONSTRAINT "estagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_estagio" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "estagio_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrado_em" TIMESTAMPTZ(3),

    CONSTRAINT "vinculo_estagio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_instituicao_id_codigo_key" ON "disciplina"("instituicao_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_id_instituicao_id_key" ON "disciplina"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "campo_estagio_instituicao_id_nome_key" ON "campo_estagio"("instituicao_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "campo_estagio_id_instituicao_id_key" ON "campo_estagio"("id", "instituicao_id");

-- CreateIndex
CREATE INDEX "matricula_turma_instituicao_id_turma_id_idx" ON "matricula_turma"("instituicao_id", "turma_id");

-- CreateIndex
CREATE INDEX "matricula_turma_aluno_id_idx" ON "matricula_turma"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "matricula_turma_id_instituicao_id_turma_id_aluno_id_key" ON "matricula_turma"("id", "instituicao_id", "turma_id", "aluno_id");

-- CreateIndex
CREATE INDEX "estagio_instituicao_id_professora_id_idx" ON "estagio"("instituicao_id", "professora_id");

-- CreateIndex
CREATE INDEX "estagio_turma_id_idx" ON "estagio"("turma_id");

-- CreateIndex
CREATE INDEX "estagio_disciplina_id_idx" ON "estagio"("disciplina_id");

-- CreateIndex
CREATE INDEX "estagio_campo_estagio_id_idx" ON "estagio"("campo_estagio_id");

-- CreateIndex
CREATE UNIQUE INDEX "estagio_instituicao_id_codigo_key" ON "estagio"("instituicao_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estagio_id_instituicao_id_turma_id_disciplina_id_key" ON "estagio"("id", "instituicao_id", "turma_id", "disciplina_id");

-- CreateIndex
CREATE INDEX "vinculo_estagio_instituicao_id_estagio_id_idx" ON "vinculo_estagio"("instituicao_id", "estagio_id");

-- CreateIndex
CREATE INDEX "vinculo_estagio_aluno_id_disciplina_id_idx" ON "vinculo_estagio"("aluno_id", "disciplina_id");

-- CreateIndex
CREATE INDEX "vinculo_estagio_matricula_id_idx" ON "vinculo_estagio"("matricula_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_id_instituicao_id_key" ON "usuario"("id", "instituicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_id_instituicao_id_key" ON "turma"("id", "instituicao_id");

-- AddForeignKey
ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campo_estagio" ADD CONSTRAINT "campo_estagio_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_turma_id_instituicao_id_fkey" FOREIGN KEY ("turma_id", "instituicao_id") REFERENCES "turma"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_aluno_id_instituicao_id_fkey" FOREIGN KEY ("aluno_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_criado_por_id_instituicao_id_fkey" FOREIGN KEY ("criado_por_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio" ADD CONSTRAINT "estagio_turma_id_instituicao_id_fkey" FOREIGN KEY ("turma_id", "instituicao_id") REFERENCES "turma"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio" ADD CONSTRAINT "estagio_disciplina_id_instituicao_id_fkey" FOREIGN KEY ("disciplina_id", "instituicao_id") REFERENCES "disciplina"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio" ADD CONSTRAINT "estagio_campo_estagio_id_instituicao_id_fkey" FOREIGN KEY ("campo_estagio_id", "instituicao_id") REFERENCES "campo_estagio"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio" ADD CONSTRAINT "estagio_professora_id_instituicao_id_fkey" FOREIGN KEY ("professora_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio" ADD CONSTRAINT "estagio_criado_por_id_instituicao_id_fkey" FOREIGN KEY ("criado_por_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_estagio" ADD CONSTRAINT "vinculo_estagio_estagio_id_instituicao_id_turma_id_discipl_fkey" FOREIGN KEY ("estagio_id", "instituicao_id", "turma_id", "disciplina_id") REFERENCES "estagio"("id", "instituicao_id", "turma_id", "disciplina_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_estagio" ADD CONSTRAINT "vinculo_estagio_matricula_id_instituicao_id_turma_id_aluno_fkey" FOREIGN KEY ("matricula_id", "instituicao_id", "turma_id", "aluno_id") REFERENCES "matricula_turma"("id", "instituicao_id", "turma_id", "aluno_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_estagio" ADD CONSTRAINT "vinculo_estagio_criado_por_id_instituicao_id_fkey" FOREIGN KEY ("criado_por_id", "instituicao_id") REFERENCES "usuario"("id", "instituicao_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "matricula_turma_aluno_ativa" ON "matricula_turma" ("aluno_id") WHERE "encerrado_em" IS NULL;
CREATE UNIQUE INDEX "vinculo_estagio_aluno_disciplina_ativo" ON "vinculo_estagio" ("aluno_id", "disciplina_id") WHERE "encerrado_em" IS NULL;
ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_carga_positiva" CHECK ("carga_horaria_total" BETWEEN 1 AND 10000);
ALTER TABLE "matricula_turma" ADD CONSTRAINT "matricula_turma_periodo" CHECK ("encerrado_em" IS NULL OR "encerrado_em" >= "iniciado_em");
ALTER TABLE "vinculo_estagio" ADD CONSTRAINT "vinculo_estagio_periodo" CHECK ("encerrado_em" IS NULL OR "encerrado_em" >= "iniciado_em");
ALTER TABLE "disciplina" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campo_estagio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matricula_turma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estagio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vinculo_estagio" ENABLE ROW LEVEL SECURITY;

COMMIT;
