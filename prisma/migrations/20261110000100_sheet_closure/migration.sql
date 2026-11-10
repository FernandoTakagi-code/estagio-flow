BEGIN;
CREATE UNIQUE INDEX ficha_estagio_id_instituicao_id_key ON ficha_estagio(id, instituicao_id);
CREATE TABLE ficha_fechamento (
  id UUID PRIMARY KEY,
  instituicao_id UUID NOT NULL,
  ficha_id UUID NOT NULL UNIQUE,
  professora_id UUID NOT NULL,
  coren VARCHAR(30) NOT NULL CHECK (length(btrim(coren)) > 0),
  data_ultimo_dia DATE NOT NULL,
  total_minutos INTEGER NOT NULL CHECK (total_minutos > 0),
  revisao VARCHAR(64) NOT NULL,
  snapshot JSONB NOT NULL,
  criado_em TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ficha_id, instituicao_id) REFERENCES ficha_estagio(id, instituicao_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (professora_id, instituicao_id) REFERENCES usuario(id, instituicao_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX ficha_fechamento_instituicao_id_idx ON ficha_fechamento(instituicao_id);
CREATE UNIQUE INDEX ficha_fechamento_ficha_id_instituicao_id_key ON ficha_fechamento(ficha_id, instituicao_id);
ALTER TABLE ficha_fechamento ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION impedir_alteracao_fechamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O fechamento definitivo não pode ser alterado ou excluído.';
END;
$$;
CREATE TRIGGER fechamento_imutavel BEFORE UPDATE OR DELETE ON ficha_fechamento
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_fechamento();

-- Lock the sheet before checking closure, including direct writes outside Express.
CREATE FUNCTION proteger_registro_ficha_fechada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ficha UUID;
BEGIN
  ficha := CASE WHEN TG_OP = 'DELETE' THEN OLD.ficha_id ELSE NEW.ficha_id END;
  IF TG_OP = 'UPDATE' AND NEW.ficha_id <> OLD.ficha_id THEN
    RAISE EXCEPTION 'O registro não pode mudar de ficha.';
  END IF;
  PERFORM id FROM ficha_estagio WHERE id = ficha FOR UPDATE;
  IF EXISTS (SELECT 1 FROM ficha_fechamento WHERE ficha_id = ficha) THEN
    RAISE EXCEPTION 'Ficha fechada: registros não podem ser criados, alterados ou excluídos.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER registro_ficha_fechada BEFORE INSERT OR UPDATE OR DELETE ON registro_estagio
  FOR EACH ROW EXECUTE FUNCTION proteger_registro_ficha_fechada();

CREATE FUNCTION proteger_aprovacao_ficha_fechada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ficha UUID;
BEGIN
  IF TG_TABLE_NAME = 'reabertura_aprovacao' THEN
    SELECT r.ficha_id INTO ficha FROM registro_estagio r
      JOIN aprovacao_registro a ON a.registro_id = r.id WHERE a.id = NEW.aprovacao_id;
  ELSE
    SELECT ficha_id INTO ficha FROM registro_estagio WHERE id = NEW.registro_id;
  END IF;
  PERFORM id FROM ficha_estagio WHERE id = ficha FOR UPDATE;
  IF EXISTS (SELECT 1 FROM ficha_fechamento WHERE ficha_id = ficha) THEN
    RAISE EXCEPTION 'Ficha fechada: aprovações não podem ser adicionadas ou reabertas.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aprovacao_ficha_fechada BEFORE INSERT ON aprovacao_registro
  FOR EACH ROW EXECUTE FUNCTION proteger_aprovacao_ficha_fechada();
CREATE TRIGGER reabertura_ficha_fechada BEFORE INSERT ON reabertura_aprovacao
  FOR EACH ROW EXECUTE FUNCTION proteger_aprovacao_ficha_fechada();
COMMIT;
