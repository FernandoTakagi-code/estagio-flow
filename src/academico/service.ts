import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/service.js';
import type { z } from 'zod';
import type { estagioSchema } from './schemas.js';

type Tx = Prisma.TransactionClient;

async function lockStudent(tx: Tx, actor: Actor, id: string, active = true) {
  const users = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "usuario"
    WHERE "id" = ${id}::uuid AND "instituicao_id" = ${actor.instituicaoId}::uuid
      AND "perfil" = 'aluno' AND ("ativo" = true OR ${!active})
    FOR UPDATE`;
  if (!users.length) throw new HttpError(404, 'Aluno não encontrado ou indisponível.');
}

async function lockGroup(tx: Tx, actor: Actor, id: string, allowClosed = false) {
  const groups = await tx.$queryRaw<{ id: string; turmaId: string; disciplinaId: string; encerradoEm: Date | null }[]>`
    SELECT "id", "turma_id" AS "turmaId", "disciplina_id" AS "disciplinaId", "encerrado_em" AS "encerradoEm"
    FROM "estagio" WHERE "id" = ${id}::uuid AND "instituicao_id" = ${actor.instituicaoId}::uuid
    FOR UPDATE`;
  const group = groups[0];
  if (!group) throw new HttpError(404, 'Grupo de estágio não encontrado.');
  if (group.encerradoEm && !allowClosed) throw new HttpError(409, 'Grupo de estágio encerrado.');
  return group;
}

async function databaseNow(tx: Tx) {
  const rows = await tx.$queryRaw<{ agora: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp()) AS agora`;
  return rows[0]!.agora;
}

export function stageScope(actor: Actor): Prisma.EstagioWhereInput {
  if (actor.perfil === 'professora') return { instituicaoId: actor.instituicaoId, professoraId: actor.id };
  if (actor.perfil === 'aluno') return { instituicaoId: actor.instituicaoId, vinculos: { some: { alunoId: actor.id } } };
  return { instituicaoId: actor.instituicaoId };
}

export const stageSelect = {
  id: true, codigo: true, criadoEm: true, encerradoEm: true,
  turma: { select: { id: true, codigo: true } },
  disciplina: { select: { id: true, codigo: true, nome: true, cargaHorariaTotal: true } },
  campoEstagio: { select: { id: true, nome: true } },
  professora: { select: { id: true, nome: true, coren: true, ativo: true } },
} satisfies Prisma.EstagioSelect;

export async function setStudentClass(actor: Actor, alunoId: string, turmaId: string) {
  return prisma.$transaction(async (tx) => {
    // Serialize all enrollment changes for the same student, including concurrent transfers.
    await lockStudent(tx, actor, alunoId);
    const target = await tx.turma.findFirst({ where: { id: turmaId, instituicaoId: actor.instituicaoId }, select: { id: true } });
    if (!target) throw new HttpError(404, 'Turma não encontrada.');
    const current = await tx.matriculaTurma.findFirst({ where: { alunoId, instituicaoId: actor.instituicaoId, encerradoEm: null } });
    if (current?.turmaId === turmaId) return { matricula: current, criada: false, transferido: false };
    const now = await databaseNow(tx);
    if (current) {
      await tx.vinculoEstagio.updateMany({ where: { alunoId, instituicaoId: actor.instituicaoId, encerradoEm: null }, data: { encerradoEm: now } });
      await tx.matriculaTurma.update({ where: { id: current.id }, data: { encerradoEm: now } });
    }
    const matricula = await tx.matriculaTurma.create({
      data: { alunoId, turmaId, instituicaoId: actor.instituicaoId, criadoPorId: actor.id, iniciadoEm: now },
    });
    return { matricula, criada: true, transferido: !!current };
  });
}

export async function closeStudentClass(actor: Actor, alunoId: string) {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId, false);
    const current = await tx.matriculaTurma.findFirst({ where: { alunoId, instituicaoId: actor.instituicaoId, encerradoEm: null } });
    if (!current) throw new HttpError(404, 'Matrícula ativa não encontrada.');
    const now = await databaseNow(tx);
    await tx.vinculoEstagio.updateMany({ where: { alunoId, instituicaoId: actor.instituicaoId, encerradoEm: null }, data: { encerradoEm: now } });
    await tx.matriculaTurma.update({ where: { id: current.id }, data: { encerradoEm: now } });
  });
}

export async function createStage(actor: Actor, data: z.infer<typeof estagioSchema>) {
  return prisma.$transaction(async (tx) => {
    const turma = await tx.turma.findFirst({ where: { id: data.turmaId, instituicaoId: actor.instituicaoId }, select: { id: true } });
    const disciplina = await tx.disciplina.findFirst({ where: { id: data.disciplinaId, instituicaoId: actor.instituicaoId }, select: { id: true } });
    const campo = await tx.campoEstagio.findFirst({ where: { id: data.campoEstagioId, instituicaoId: actor.instituicaoId }, select: { id: true } });
    const professora = await tx.usuario.findFirst({ where: { id: data.professoraId, instituicaoId: actor.instituicaoId, perfil: 'professora', ativo: true }, select: { id: true } });
    if (!turma || !disciplina || !campo || !professora) throw new HttpError(404, 'Turma, disciplina, local ou professora não encontrado ou indisponível.');
    return tx.estagio.create({ data: { ...data, instituicaoId: actor.instituicaoId, criadoPorId: actor.id }, select: stageSelect });
  });
}

export async function assignStudent(actor: Actor, estagioId: string, alunoId: string) {
  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId);
    const group = await lockGroup(tx, actor, estagioId);
    const matricula = await tx.matriculaTurma.findFirst({
      where: { alunoId, turmaId: group.turmaId, instituicaoId: actor.instituicaoId, encerradoEm: null },
    });
    if (!matricula) throw new HttpError(409, 'Aluno precisa ter matrícula ativa na turma do grupo.');
    const current = await tx.vinculoEstagio.findFirst({
      where: { alunoId, disciplinaId: group.disciplinaId, instituicaoId: actor.instituicaoId, encerradoEm: null },
    });
    if (current?.estagioId === estagioId) return { vinculo: current, criado: false, transferido: false };
    const now = await databaseNow(tx);
    if (current) await tx.vinculoEstagio.update({ where: { id: current.id }, data: { encerradoEm: now } });
    const vinculo = await tx.vinculoEstagio.create({
      data: { alunoId, estagioId, matriculaId: matricula.id, turmaId: group.turmaId, disciplinaId: group.disciplinaId, instituicaoId: actor.instituicaoId, criadoPorId: actor.id, iniciadoEm: now },
    });
    return { vinculo, criado: true, transferido: !!current };
  });
}

export async function closeStudentStage(actor: Actor, estagioId: string, alunoId: string) {
  await prisma.$transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId, false);
    await lockGroup(tx, actor, estagioId, true);
    const now = await databaseNow(tx);
    const closed = await tx.vinculoEstagio.updateMany({
      where: { alunoId, estagioId, instituicaoId: actor.instituicaoId, encerradoEm: null }, data: { encerradoEm: now },
    });
    if (!closed.count) throw new HttpError(409, 'Vínculo ativo não encontrado neste grupo.');
  });
}

export async function closeStage(actor: Actor, estagioId: string) {
  await prisma.$transaction(async (tx) => {
    await lockGroup(tx, actor, estagioId);
    const now = await databaseNow(tx);
    await tx.estagio.update({ where: { id: estagioId }, data: { encerradoEm: now } });
    await tx.vinculoEstagio.updateMany({ where: { estagioId, instituicaoId: actor.instituicaoId, encerradoEm: null }, data: { encerradoEm: now } });
  });
}
