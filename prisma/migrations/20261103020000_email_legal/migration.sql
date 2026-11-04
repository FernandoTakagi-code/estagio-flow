BEGIN;
-- CreateTable
CREATE TABLE "recuperacao_senha" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usado_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),

    CONSTRAINT "recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem_email" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "referencia_hash" VARCHAR(64) NOT NULL,
    "conteudo_cifrado" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disponivel_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trava_em" TIMESTAMPTZ(3),
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "codigo_erro" VARCHAR(40),

    CONSTRAINT "mensagem_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_legal" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "versao" VARCHAR(100) NOT NULL,
    "hash_documento" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "origem" VARCHAR(20) NOT NULL,
    "registrado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_legal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recuperacao_senha_token_hash_key" ON "recuperacao_senha"("token_hash");

-- CreateIndex
CREATE INDEX "recuperacao_senha_usuario_id_criado_em_idx" ON "recuperacao_senha"("usuario_id", "criado_em");

-- CreateIndex
CREATE INDEX "mensagem_email_estado_disponivel_em_idx" ON "mensagem_email"("estado", "disponivel_em");

-- CreateIndex
CREATE UNIQUE INDEX "registro_legal_usuario_id_tipo_hash_documento_key" ON "registro_legal"("usuario_id", "tipo", "hash_documento");

-- AddForeignKey
ALTER TABLE "recuperacao_senha" ADD CONSTRAINT "recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem_email" ADD CONSTRAINT "mensagem_email_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_legal" ADD CONSTRAINT "registro_legal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE recuperacao_senha ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagem_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_legal ENABLE ROW LEVEL SECURITY;
ALTER TABLE recuperacao_senha ADD CONSTRAINT recuperacao_expiracao CHECK (expira_em > criado_em AND token_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE mensagem_email ADD CONSTRAINT mensagem_email_estado CHECK (estado IN ('pendente', 'enviando', 'enviada', 'falha', 'cancelada') AND tipo IN ('convite', 'recuperacao') AND tentativas >= 0 AND referencia_hash ~ '^[a-f0-9]{64}$' AND (estado NOT IN ('enviada', 'falha', 'cancelada') OR conteudo_cifrado IS NULL));
ALTER TABLE registro_legal ADD CONSTRAINT registro_legal_tipo CHECK (tipo IN ('termos', 'privacidade') AND origem IN ('convite', 'acesso') AND hash_documento ~ '^[a-f0-9]{64}$');
CREATE FUNCTION proteger_registro_legal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro de documentos é imutável'; END; $$;
CREATE TRIGGER registro_legal_imutavel BEFORE UPDATE OR DELETE ON registro_legal FOR EACH ROW EXECUTE FUNCTION proteger_registro_legal();
COMMIT;
