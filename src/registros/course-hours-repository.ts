import { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/service.js';

export type CourseHours = {
  disciplinaId: string; codigo: string; nome: string; cargaHorariaMinutos: number;
  minutosAprovados: number; minutosEnviados: number; possuiVinculo: boolean;
};

// This single-course installation uses the institution's discipline catalog as its curriculum.
// Teacher queries stay restricted to their groups, including historical links.
export function courseHours(tx: Prisma.TransactionClient, actor: Actor, alunoId: string, pagina?: number) {
  return tx.$queryRaw<CourseHours[]>(Prisma.sql`
    SELECT d.id AS "disciplinaId", d.codigo, d.nome, d.carga_horaria_total * 60 AS "cargaHorariaMinutos",
      COUNT(DISTINCT v.id) > 0 AS "possuiVinculo",
      COALESCE(SUM(CASE WHEN r.status = 'aprovado' AND a.id IS NOT NULL AND re.id IS NULL
        THEN r.duracao_minutos ELSE 0 END), 0)::double precision AS "minutosAprovados",
      COALESCE(SUM(CASE WHEN r.status = 'enviado' THEN r.duracao_minutos ELSE 0 END), 0)::double precision AS "minutosEnviados"
    FROM disciplina d
    LEFT JOIN vinculo_estagio v ON v.disciplina_id = d.id AND v.instituicao_id = d.instituicao_id
      AND v.aluno_id = ${alunoId}::uuid
      AND (${actor.perfil} <> 'professora' OR EXISTS (
        SELECT 1 FROM estagio e WHERE e.id = v.estagio_id AND e.instituicao_id = v.instituicao_id
          AND e.professora_id = ${actor.id}::uuid))
    LEFT JOIN ficha_estagio f ON f.vinculo_id = v.id AND f.instituicao_id = v.instituicao_id
    LEFT JOIN registro_estagio r ON r.ficha_id = f.id AND r.instituicao_id = f.instituicao_id
    LEFT JOIN aprovacao_registro a ON a.registro_id = r.id AND a.instituicao_id = r.instituicao_id AND a.versao = r.versao
    LEFT JOIN reabertura_aprovacao re ON re.aprovacao_id = a.id AND re.instituicao_id = a.instituicao_id
    WHERE d.instituicao_id = ${actor.instituicaoId}::uuid
      AND (${actor.perfil} <> 'professora' OR v.id IS NOT NULL)
    GROUP BY d.id, d.codigo, d.nome, d.carga_horaria_total
    ORDER BY d.codigo, d.id ${pagina === undefined ? Prisma.empty : Prisma.sql`LIMIT 50 OFFSET ${(pagina - 1) * 50}`}
  `);
}
