import type { z } from 'zod';
import type { Actor } from '../auth/service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../lib/errors.js';
import { transaction } from '../lib/transaction.js';
import * as repository from './repository.js';
import type { approveBatchSchema } from './schemas.js';
import { lockContext, presentRecord, recordEvent } from './service.js';
import { courseHours } from './course-hours.js';

function requireTeacher(actor: Actor) {
  if (actor.perfil !== 'professora') throw new HttpError(403, 'Somente a professora responsável pode executar esta ação.');
}

export async function approveRecords(actor: Actor, input: z.infer<typeof approveBatchSchema>) {
  requireTeacher(actor);
  return transaction(async (tx) => {
    const refs = await repository.findBatchReferences(tx, actor, input.registros.map((item) => item.id));
    if (refs.length !== input.registros.length) throw new HttpError(404, 'Um ou mais registros não foram encontrados.');
    const first = refs[0]!;
    if (refs.some((ref) => ref.fichaId !== first.fichaId)) throw new HttpError(400, 'O lote deve conter registros de uma única ficha.');
    await lockContext(tx, actor, first.ficha.vinculoId);
    // Read again after locking: another request may have changed a version while this one waited.
    const current = await repository.readBatch(tx, refs.map((ref) => ref.id));
    for (const record of current) {
      const expected = input.registros.find((item) => item.id === record.id)!;
      if (record.status !== 'enviado' || record.versao !== expected.versao) {
        throw new HttpError(409, 'O lote contém registro alterado ou que não está enviado. Atualize a consulta.');
      }
    }
    const sheet = await repository.approvalSheet(tx, first.fichaId);
    const result = [];
    for (const record of current) {
      const approved = await repository.updateRecord(tx, record.id, { status: 'aprovado', versao: { increment: 1 } });
      const approval = await repository.insertApproval(tx, {
        instituicaoId: actor.instituicaoId, registroId: approved.id, professoraId: actor.id, versao: approved.versao,
        snapshot: JSON.parse(JSON.stringify({
          registro: presentRecord(approved), ficha: sheet,
          professora: { id: actor.id, nome: actor.nome, coren: actor.coren },
        })) as Prisma.InputJsonValue,
      });
      await recordEvent(tx, actor, approved, 'aprovado');
      result.push({ registro: presentRecord(approved), aprovacao: approval });
    }
    return { aprovacoes: result };
  });
}

export async function reopenRecord(actor: Actor, id: string, versao: number, motivo: string) {
  requireTeacher(actor);
  return transaction(async (tx) => {
    const ref = await repository.findReference(tx, actor, id);
    if (!ref) throw new HttpError(404, 'Registro não encontrado.');
    await lockContext(tx, actor, ref.ficha.vinculoId);
    const current = await repository.currentRecord(tx, id);
    if (current.status !== 'aprovado' || current.versao !== versao) throw new HttpError(409, 'Registro alterado ou sem aprovação vigente. Atualize a consulta.');
    const approval = await repository.currentApproval(tx, actor.instituicaoId, id, versao);
    if (!approval) throw new HttpError(409, 'Aprovação vigente não encontrada.');
    const reabertura = await repository.insertReopening(tx, {
      instituicaoId: actor.instituicaoId, aprovacaoId: approval.id, professoraId: actor.id, motivo,
    });
    const record = await repository.updateRecord(tx, id, { status: 'devolvido', versao: { increment: 1 } });
    await recordEvent(tx, actor, record, 'reaberto', motivo);
    return { registro: presentRecord(record), reabertura };
  });
}

export async function listApprovals(actor: Actor, id: string, pagina: number) {
  // Keep the record and its approval flags in one consistent database snapshot.
  return transaction(async (tx) => {
    const record = await repository.readApprovalStatus(tx, actor, id);
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    const approvals = await repository.readApprovals(tx, actor.instituicaoId, id, pagina);
    return { aprovacoes: approvals.map((approval) => ({ ...approval, vigente: record.status === 'aprovado' && record.versao === approval.versao && !approval.reabertura })), pagina, porPagina: 50 };
  }, { isolationLevel: 'RepeatableRead' });
}

export async function studentHours(actor: Actor, alunoId: string, pagina: number) {
  if (actor.perfil === 'aluno' && actor.id !== alunoId) throw new HttpError(404, 'Aluno não encontrado.');
  return transaction(async (tx) => {
    const student = await repository.findStudent(tx, actor, alunoId);
    if (!student) throw new HttpError(404, 'Aluno não encontrado.');
    // Count only the current version's approval, with no reopening. Historical approvals never add hours twice.
    const disciplines = await courseHours(tx, actor, alunoId, pagina);
    const partial = actor.perfil === 'professora';
    return {
      aluno: student, escopo: partial ? 'grupos_da_professora' : 'aluno_na_instituicao',
      disciplinas: disciplines.map((row) => ({ ...row,
        minutosRestantes: partial ? null : Math.max(0, row.cargaHorariaMinutos - row.minutosAprovados),
        minutosExcedentes: partial ? null : Math.max(0, row.minutosAprovados - row.cargaHorariaMinutos),
      })), pagina, porPagina: 50,
    };
  }, { isolationLevel: 'RepeatableRead' });
}
