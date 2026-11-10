BEGIN;
CREATE FUNCTION notas_estagio_validas(notas NUMERIC[]) RETURNS boolean LANGUAGE SQL IMMUTABLE AS $$
  SELECT cardinality(notas) = 9 AND array_ndims(notas) = 1 AND array_lower(notas, 1) = 1
    AND NOT EXISTS (SELECT 1 FROM unnest(notas) n WHERE n IS NULL OR n < 0 OR n > 10 OR n::text = 'NaN');
$$;
CREATE TABLE avaliacao_estagio (
  id UUID PRIMARY KEY,
  instituicao_id UUID NOT NULL,
  ficha_id UUID NOT NULL,
  professora_id UUID NOT NULL,
  versao INTEGER NOT NULL CHECK (versao > 0),
  notas NUMERIC(4,2)[] NOT NULL CHECK (notas_estagio_validas(notas)),
  motivo VARCHAR(1000),
  snapshot JSONB NOT NULL,
  criado_em TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT avaliacao_estagio_ficha_id_versao_key UNIQUE(ficha_id, versao),
  FOREIGN KEY(ficha_id, instituicao_id) REFERENCES ficha_estagio(id, instituicao_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY(professora_id, instituicao_id) REFERENCES usuario(id, instituicao_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (versao = 1 OR (motivo IS NOT NULL AND length(btrim(motivo)) > 0))
);
CREATE INDEX avaliacao_estagio_instituicao_id_idx ON avaliacao_estagio(instituicao_id);
ALTER TABLE avaliacao_estagio ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER avaliacao_imutavel BEFORE UPDATE OR DELETE ON avaliacao_estagio
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_fechamento();
COMMIT;
