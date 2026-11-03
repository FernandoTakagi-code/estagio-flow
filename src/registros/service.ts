import { transaction } from '../lib/transaction.js';
import * as repository from './repository.js';
import { validateRecordSession, validateUnscheduledRecord } from '../agenda/record-service.js';
export { recordScope, sheetScope } from './access.js';
import { HttpError } from '../lib/errors.js';
import type { Actor } from '../auth/service.js';
import type { Prisma, RegistroEstagio } from '../generated/prisma/client.js';
import type { z } from 'zod';
import { minutes, type createRecordSchema, type editRecordSchema } from './schemas.js';

type Tx = Prisma.TransactionClient;
const schoolDate = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(value);
const dateText = (value: Date) => value.toISOString().slice(0, 10);
const timeText = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;

export function presentRecord(record: RegistroEstagio) {
  const { inicioMinuto, fimMinuto, ...rest } = record;
  return { ...rest, data: dateText(record.data), horaInicio: timeText(inicioMinuto), horaFim: timeText(fimMinuto) };
}

export async function lockContext(tx: Tx, actor: Actor, vinculoId: string, creating = false) {
  const ref = await repository.findLink(tx, actor.instituicaoId, vinculoId);
  if (!ref || (actor.perfil === 'aluno' && ref.alunoId !== actor.id)) throw new HttpError(404, 'Vínculo não encontrado.');
  // Use the same lock order as enrollment transfers: student, group, then link.
  const link = await repository.lockLinkContext(tx, ref);
  if (actor.perfil === 'professora' && link.estagio.professoraId !== actor.id) throw new HttpError(404, 'Vínculo não encontrado.');
  if (creating && (link.encerradoEm || link.estagio.encerradoEm)) throw new HttpError(409, 'Vínculo encerrado: não aceita novos registros.');
  return link;
}

function checkPeriod(data: string, link: { iniciadoEm: Date; encerradoEm: Date | null }) {
  if (data < schoolDate(link.iniciadoEm) || (link.encerradoEm && data > schoolDate(link.encerradoEm))) {
    throw new HttpError(409, 'A data precisa estar dentro do período do vínculo.');
  }
  if (data > schoolDate(new Date())) throw new HttpError(409, 'Não é possível registrar estágio em data futura.');
}

async function checkOverlap(tx: Tx, alunoId: string, data: Date, inicioMinuto: number, fimMinuto: number, id?: string) {
  const overlap = await repository.findOverlap(tx, alunoId, data, inicioMinuto, fimMinuto, id);
  if (overlap) throw new HttpError(409, 'O horário coincide com outro registro do aluno, inclusive de outra disciplina.');
}

function recordData(input: { data: string; horaInicio: string; horaFim: string; atividades: string }) {
  const inicioMinuto = minutes(input.horaInicio);
  const fimMinuto = minutes(input.horaFim);
  return { data: new Date(`${input.data}T00:00:00.000Z`), inicioMinuto, fimMinuto, duracaoMinutos: fimMinuto - inicioMinuto, atividades: input.atividades };
}

export async function recordEvent(tx: Tx, actor: Actor, record: RegistroEstagio, acao: string, motivo?: string) {
  await repository.insertEvent(tx, {
    instituicaoId: actor.instituicaoId, autorId: actor.id, registroId: record.id,
    versao: record.versao, acao, motivo,
    snapshot: JSON.parse(JSON.stringify(presentRecord(record))) as Prisma.InputJsonValue,
  });
}

export async function createRecord(actor: Actor, input: z.infer<typeof createRecordSchema>) {
  if (actor.perfil !== 'aluno') throw new HttpError(403, 'Somente o aluno pode registrar suas atividades.');
  return transaction(async (tx) => {
    const link = await lockContext(tx, actor, input.vinculoId, true);
    checkPeriod(input.data, link);
    if (input.sessaoId) await validateRecordSession(tx, actor, input.sessaoId, link.id, input);
    else await validateUnscheduledRecord(tx, link.estagioId, link.id, input);
    const data = recordData(input);
    await checkOverlap(tx, actor.id, data.data, data.inicioMinuto, data.fimMinuto);
    const ficha = await repository.ensureSheet(tx, link.id, actor.instituicaoId, actor.id);
    const record = await repository.insertRecord(tx, { ...data, sessaoId: input.sessaoId, fichaId: ficha.id, alunoId: actor.id, instituicaoId: actor.instituicaoId });
    await recordEvent(tx, actor, record, 'criado');
    return presentRecord(record);
  });
}

export async function changeRecord(actor: Actor, id: string, versao: number, action: 'editar' | 'enviar' | 'devolver' | 'cancelar', input?: z.infer<typeof editRecordSchema>, motivo?: string) {
  if ((action === 'devolver' && actor.perfil !== 'professora') || (action !== 'devolver' && actor.perfil !== 'aluno')) throw new HttpError(403, 'Perfil sem permissão para esta ação.');
  return transaction(async (tx) => {
    const ref = await repository.findReference(tx, actor, id);
    if (!ref) throw new HttpError(404, 'Registro não encontrado.');
    const link = await lockContext(tx, actor, ref.ficha.vinculoId);
    const current = await repository.currentRecord(tx, id);
    if (current.versao !== versao) throw new HttpError(409, 'Registro alterado. Atualize a consulta antes de continuar.');
    if (action === 'devolver' ? current.status !== 'enviado' : !['rascunho', 'devolvido'].includes(current.status)) throw new HttpError(409, 'O estado atual não permite esta ação.');
    const data = input ? recordData(input) : undefined;
    if (current.sessaoId && input) await validateRecordSession(tx, actor, current.sessaoId, link.id, input);
    if (!current.sessaoId && input) await validateUnscheduledRecord(tx, link.estagioId, link.id, input);
    checkPeriod(input?.data ?? dateText(current.data), link);
    if (data) await checkOverlap(tx, current.alunoId, data.data, data.inicioMinuto, data.fimMinuto, id);
    const record = await repository.updateRecord(tx, id, {
      ...data, versao: { increment: 1 }, status: action === 'enviar' ? 'enviado' : action === 'devolver' ? 'devolvido' : action === 'cancelar' ? 'cancelado' : current.status,
    });
    await recordEvent(tx, actor, record, action === 'editar' ? 'editado' : action === 'enviar' ? 'enviado' : action === 'cancelar' ? 'cancelado' : 'devolvido', motivo);
    return presentRecord(record);
  });
}
