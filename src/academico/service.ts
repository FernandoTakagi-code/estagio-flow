import { transaction } from '../lib/transaction.js';
import * as repository from './repository.js';
export { stageScope } from './access.js';
import { databaseNow } from './repository.js';
export { stageSelect } from './repository.js';
import { HttpError } from '../lib/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/service.js';
import type { z } from 'zod';
import type { estagioSchema } from './schemas.js';

type Tx = Prisma.TransactionClient;

async function lockStudent(tx: Tx, actor: Actor, id: string, active = true) {
  const users = await repository.lockStudentRow(tx, actor.instituicaoId, id, active);
  if (!users.length) throw new HttpError(404, 'Aluno não encontrado ou indisponível.');
}

async function lockGroup(tx: Tx, actor: Actor, id: string, allowClosed = false) {
  const groups = await repository.lockGroupRow(tx, actor.instituicaoId, id);
  const group = groups[0];
  if (!group) throw new HttpError(404, 'Grupo de estágio não encontrado.');
  if (group.encerradoEm && !allowClosed) throw new HttpError(409, 'Grupo de estágio encerrado.');
  return group;
}




export async function setStudentClass(actor: Actor, alunoId: string, turmaId: string) {
  return transaction(async (tx) => {
    // Serialize all enrollment changes for the same student, including concurrent transfers.
    await lockStudent(tx, actor, alunoId);
    const target = await repository.findClass(tx, actor.instituicaoId, turmaId);
    if (!target) throw new HttpError(404, 'Turma não encontrada.');
    const current = await repository.activeEnrollment(tx, actor.instituicaoId, alunoId);
    if (current?.turmaId === turmaId) return { matricula: current, criada: false, transferido: false };
    const now = await databaseNow(tx);
    if (current) {
      await repository.closeLinks(tx, actor.instituicaoId, now, { alunoId });
      await repository.closeEnrollment(tx, current.id, now);
    }
    const matricula = await repository.insertEnrollment(tx, { alunoId, turmaId, instituicaoId: actor.instituicaoId, criadoPorId: actor.id, iniciadoEm: now });
    return { matricula, criada: true, transferido: !!current };
  });
}

export async function closeStudentClass(actor: Actor, alunoId: string) {
  await transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId, false);
    const current = await repository.activeEnrollment(tx, actor.instituicaoId, alunoId);
    if (!current) throw new HttpError(404, 'Matrícula ativa não encontrada.');
    const now = await databaseNow(tx);
    await repository.closeLinks(tx, actor.instituicaoId, now, { alunoId });
    await repository.closeEnrollment(tx, current.id, now);
  });
}

export async function createStage(actor: Actor, data: z.infer<typeof estagioSchema>) {
  return transaction(async (tx) => {
    const turma = await repository.findClass(tx, actor.instituicaoId, data.turmaId);
    const disciplina = await repository.findDiscipline(tx, actor.instituicaoId, data.disciplinaId);
    const campo = await repository.findField(tx, actor.instituicaoId, data.campoEstagioId);
    const professora = await repository.findTeacher(tx, actor.instituicaoId, data.professoraId);
    if (!turma || !disciplina || !campo || !professora) throw new HttpError(404, 'Turma, disciplina, local ou professora não encontrado ou indisponível.');
    return repository.insertGroup(tx, { ...data, instituicaoId: actor.instituicaoId, criadoPorId: actor.id });
  });
}

export async function assignStudent(actor: Actor, estagioId: string, alunoId: string) {
  return transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId);
    const group = await lockGroup(tx, actor, estagioId);
    const matricula = await repository.activeEnrollment(tx, actor.instituicaoId, alunoId, group.turmaId);
    if (!matricula) throw new HttpError(409, 'Aluno precisa ter matrícula ativa na turma do grupo.');
    const current = await repository.activeDisciplineLink(tx, actor.instituicaoId, alunoId, group.disciplinaId);
    if (current?.estagioId === estagioId) return { vinculo: current, criado: false, transferido: false };
    const now = await databaseNow(tx);
    if (current) await repository.closeLink(tx, current.id, now);
    const vinculo = await repository.insertLink(tx, { alunoId, estagioId, matriculaId: matricula.id, turmaId: group.turmaId, disciplinaId: group.disciplinaId, instituicaoId: actor.instituicaoId, criadoPorId: actor.id, iniciadoEm: now });
    return { vinculo, criado: true, transferido: !!current };
  });
}

export async function closeStudentStage(actor: Actor, estagioId: string, alunoId: string) {
  await transaction(async (tx) => {
    await lockStudent(tx, actor, alunoId, false);
    await lockGroup(tx, actor, estagioId, true);
    const now = await databaseNow(tx);
    const closed = await repository.closeLinks(tx, actor.instituicaoId, now, { alunoId, estagioId });
    if (!closed.count) throw new HttpError(409, 'Vínculo ativo não encontrado neste grupo.');
  });
}

export async function closeStage(actor: Actor, estagioId: string) {
  await transaction(async (tx) => {
    await lockGroup(tx, actor, estagioId);
    const now = await databaseNow(tx);
    await repository.closeGroup(tx, estagioId, now);
    await repository.closeLinks(tx, actor.instituicaoId, now, { estagioId });
  });
}
