import { prisma } from '../lib/prisma.js';
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

export function sheetScope(actor: Actor): Prisma.FichaEstagioWhereInput {
  return {
    instituicaoId: actor.instituicaoId,
    ...(actor.perfil === 'aluno' ? { alunoId: actor.id } : {}),
    ...(actor.perfil === 'professora' ? { vinculo: { estagio: { professoraId: actor.id } } } : {}),
  };
}

export function recordScope(actor: Actor): Prisma.RegistroEstagioWhereInput {
  return {
    instituicaoId: actor.instituicaoId, ficha: sheetScope(actor),
    ...(actor.perfil === 'professora' ? { status: { in: ['enviado', 'devolvido'] } } : {}),
  };
}

async function lockContext(tx: Tx, actor: Actor, vinculoId: string, creating = false) {
  const ref = await tx.vinculoEstagio.findFirst({ where: { id: vinculoId, instituicaoId: actor.instituicaoId } });
  if (!ref || (actor.perfil === 'aluno' && ref.alunoId !== actor.id)) throw new HttpError(404, 'Vínculo não encontrado.');
  // Use the same lock order as enrollment transfers: student, group, then link.
  await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${ref.alunoId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM estagio WHERE id = ${ref.estagioId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM vinculo_estagio WHERE id = ${ref.id}::uuid FOR UPDATE`;
  const link = await tx.vinculoEstagio.findUniqueOrThrow({ where: { id: ref.id }, include: { estagio: true } });
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
  const overlap = await tx.registroEstagio.findFirst({
    where: { alunoId, data, status: { not: 'cancelado' }, inicioMinuto: { lt: fimMinuto }, fimMinuto: { gt: inicioMinuto }, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (overlap) throw new HttpError(409, 'O horário coincide com outro registro do aluno, inclusive de outra disciplina.');
}

function recordData(input: { data: string; horaInicio: string; horaFim: string; atividades: string }) {
  const inicioMinuto = minutes(input.horaInicio);
  const fimMinuto = minutes(input.horaFim);
  return { data: new Date(`${input.data}T00:00:00.000Z`), inicioMinuto, fimMinuto, duracaoMinutos: fimMinuto - inicioMinuto, atividades: input.atividades };
}

async function event(tx: Tx, actor: Actor, record: RegistroEstagio, acao: string, motivo?: string) {
  await tx.eventoRegistro.create({ data: {
    instituicaoId: actor.instituicaoId, autorId: actor.id, registroId: record.id,
    versao: record.versao, acao, motivo,
    snapshot: JSON.parse(JSON.stringify(presentRecord(record))) as Prisma.InputJsonValue,
  } });
}

export async function createRecord(actor: Actor, input: z.infer<typeof createRecordSchema>) {
  if (actor.perfil !== 'aluno') throw new HttpError(403, 'Somente o aluno pode registrar suas atividades.');
  return prisma.$transaction(async (tx) => {
    const link = await lockContext(tx, actor, input.vinculoId, true);
    checkPeriod(input.data, link);
    const data = recordData(input);
    await checkOverlap(tx, actor.id, data.data, data.inicioMinuto, data.fimMinuto);
    const ficha = await tx.fichaEstagio.upsert({ where: { vinculoId: link.id }, update: {}, create: { vinculoId: link.id, instituicaoId: actor.instituicaoId, alunoId: actor.id } });
    const record = await tx.registroEstagio.create({ data: { ...data, fichaId: ficha.id, alunoId: actor.id, instituicaoId: actor.instituicaoId } });
    await event(tx, actor, record, 'criado');
    return presentRecord(record);
  });
}

export async function changeRecord(actor: Actor, id: string, versao: number, action: 'editar' | 'enviar' | 'devolver' | 'cancelar', input?: z.infer<typeof editRecordSchema>, motivo?: string) {
  if ((action === 'devolver' && actor.perfil !== 'professora') || (action !== 'devolver' && actor.perfil !== 'aluno')) throw new HttpError(403, 'Perfil sem permissão para esta ação.');
  return prisma.$transaction(async (tx) => {
    const ref = await tx.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, include: { ficha: true } });
    if (!ref) throw new HttpError(404, 'Registro não encontrado.');
    const link = await lockContext(tx, actor, ref.ficha.vinculoId);
    const current = await tx.registroEstagio.findUniqueOrThrow({ where: { id } });
    if (current.versao !== versao) throw new HttpError(409, 'Registro alterado. Atualize a consulta antes de continuar.');
    if (action === 'devolver' ? current.status !== 'enviado' : !['rascunho', 'devolvido'].includes(current.status)) throw new HttpError(409, 'O estado atual não permite esta ação.');
    const data = input ? recordData(input) : undefined;
    checkPeriod(input?.data ?? dateText(current.data), link);
    if (data) await checkOverlap(tx, current.alunoId, data.data, data.inicioMinuto, data.fimMinuto, id);
    const record = await tx.registroEstagio.update({ where: { id }, data: {
      ...data, versao: { increment: 1 }, status: action === 'enviar' ? 'enviado' : action === 'devolver' ? 'devolvido' : action === 'cancelar' ? 'cancelado' : current.status,
    } });
    await event(tx, actor, record, action === 'editar' ? 'editado' : action === 'enviar' ? 'enviado' : action === 'cancelar' ? 'cancelado' : 'devolvido', motivo);
    return presentRecord(record);
  });
}
