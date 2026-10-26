BEGIN;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "criado_por_id" UUID,
ADD COLUMN     "token_versao" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "senha_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "convite_usuario" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convite_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convite_usuario_token_hash_key" ON "convite_usuario"("token_hash");

-- CreateIndex
CREATE INDEX "convite_usuario_usuario_id_idx" ON "convite_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "convite_usuario_criado_por_id_idx" ON "convite_usuario"("criado_por_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite_usuario" ADD CONSTRAINT "convite_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite_usuario" ADD CONSTRAINT "convite_usuario_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "usuario" SET "email" = lower(btrim("email"));
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_normalizado" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "convite_usuario" ENABLE ROW LEVEL SECURITY;

COMMIT;
