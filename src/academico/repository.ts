import type { Transaction } from '../lib/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';

export const lockStudentRow = (tx: Transaction, instituicaoId: string, id: string, active: boolean) => tx.$queryRaw<{ id: string }[]>`
  SELECT id FROM usuario WHERE id = ${id}::uuid AND instituicao_id = ${instituicaoId}::uuid
    AND perfil = 'aluno' AND (ativo = true OR ${!active}) FOR UPDATE`;
export const lockGroupRow = (tx: Transaction, instituicaoId: string, id: string) => tx.$queryRaw<{ id: string; turmaId: string; disciplinaId: string; encerradoEm: Date | null }[]>`
  SELECT id, turma_id AS "turmaId", disciplina_id AS "disciplinaId", encerrado_em AS "encerradoEm"
  FROM estagio WHERE id = ${id}::uuid AND instituicao_id = ${instituicaoId}::uuid FOR UPDATE`;
export async function databaseNow(tx: Transaction) {
  const rows = await tx.$queryRaw<{ agora: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp()) AS agora`;
  return rows[0]!.agora;
}
export const findClass = (tx: Transaction, instituicaoId: string, id: string) => tx.turma.findFirst({ where: { id, instituicaoId }, select: { id: true } });
export const findDiscipline = (tx: Transaction, instituicaoId: string, id: string) => tx.disciplina.findFirst({ where: { id, instituicaoId }, select: { id: true } });
export const findField = (tx: Transaction, instituicaoId: string, id: string) => tx.campoEstagio.findFirst({ where: { id, instituicaoId }, select: { id: true } });
export const findTeacher = (tx: Transaction, instituicaoId: string, id: string) => tx.usuario.findFirst({ where: { id, instituicaoId, perfil: 'professora', ativo: true }, select: { id: true } });
export const activeEnrollment = (tx: Transaction, instituicaoId: string, alunoId: string, turmaId?: string) => tx.matriculaTurma.findFirst({ where: { alunoId, instituicaoId, encerradoEm: null, ...(turmaId ? { turmaId } : {}) } });
export const activeDisciplineLink = (tx: Transaction, instituicaoId: string, alunoId: string, disciplinaId: string) => tx.vinculoEstagio.findFirst({ where: { alunoId, disciplinaId, instituicaoId, encerradoEm: null } });
export const closeLinks = (tx: Transaction, instituicaoId: string, now: Date, filter: { alunoId?: string; estagioId?: string }) => tx.vinculoEstagio.updateMany({ where: { ...filter, instituicaoId, encerradoEm: null }, data: { encerradoEm: now } });
export const closeEnrollment = (tx: Transaction, id: string, now: Date) => tx.matriculaTurma.update({ where: { id }, data: { encerradoEm: now } });
export const closeLink = (tx: Transaction, id: string, now: Date) => tx.vinculoEstagio.update({ where: { id }, data: { encerradoEm: now } });
export const closeGroup = (tx: Transaction, id: string, now: Date) => tx.estagio.update({ where: { id }, data: { encerradoEm: now } });
export const insertEnrollment = (tx: Transaction, data: Prisma.MatriculaTurmaUncheckedCreateInput) => tx.matriculaTurma.create({ data });
export const insertLink = (tx: Transaction, data: Prisma.VinculoEstagioUncheckedCreateInput) => tx.vinculoEstagio.create({ data });
export const stageSelect = {
  id: true, codigo: true, criadoEm: true, encerradoEm: true,
  turma: { select: { id: true, codigo: true } },
  disciplina: { select: { id: true, codigo: true, nome: true, cargaHorariaTotal: true } },
  campoEstagio: { select: { id: true, nome: true } },
  professora: { select: { id: true, nome: true, coren: true, ativo: true } },
} satisfies Prisma.EstagioSelect;
export const insertGroup = (tx: Transaction, data: Prisma.EstagioUncheckedCreateInput) => tx.estagio.create({ data, select: stageSelect });
