import { prisma } from '../lib/prisma.js';
import type { Transaction } from '../lib/transaction.js';
import type { Actor } from '../auth/user-select.js';
import type { Prisma } from '../generated/prisma/client.js';
import { stageScope } from '../academico/access.js';
import { stageSelect } from '../academico/repository.js';

export const sessionInclude = { estagio: { select: stageSelect } } satisfies Prisma.AgendaSessaoInclude;
export const scope = (actor: Actor): Prisma.AgendaSessaoWhereInput => ({ instituicaoId: actor.instituicaoId, estagio: stageScope(actor) });
export const findSession = (actor: Actor, id: string, tx = prisma as Transaction) => tx.agendaSessao.findFirst({ where: { ...scope(actor), id }, include: sessionInclude });
export const listSessions = (actor: Actor, where: Prisma.AgendaSessaoWhereInput, pagina: number) => prisma.agendaSessao.findMany({ where: { AND: [scope(actor), where] }, include: sessionInclude, orderBy: [{ data: 'desc' }, { inicioMinuto: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
export const findGroup = (actor: Actor, id: string, tx: Transaction) => tx.estagio.findFirst({ where: { ...stageScope(actor), id }, select: stageSelect });
export async function lockTeacherGroup(tx: Transaction, teacherId: string, groupId: string) { await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${teacherId}::uuid FOR UPDATE`; await tx.$queryRaw`SELECT id FROM estagio WHERE id = ${groupId}::uuid FOR UPDATE`; }
export async function lockSession(tx: Transaction, id: string) { await tx.$queryRaw`SELECT id FROM agenda_sessao WHERE id = ${id}::uuid FOR UPDATE`; }
export const overlapping = (tx: Transaction, teacherId: string, date: Date, start: number, end: number, id?: string) => tx.agendaSessao.findFirst({ where: { cancelada: false, data: date, estagio: { professoraId: teacherId }, inicioMinuto: { lt: end }, fimMinuto: { gt: start }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
export const insertSession = (tx: Transaction, data: Prisma.AgendaSessaoUncheckedCreateInput) => tx.agendaSessao.create({ data, include: sessionInclude });
export const updateSession = (tx: Transaction, id: string, data: Prisma.AgendaSessaoUncheckedUpdateInput) => tx.agendaSessao.update({ where: { id }, data, include: sessionInclude });
export const touched = async (tx: Transaction, id: string) => (await tx.frequenciaSessao.count({ where: { sessaoId: id } })) + (await tx.registroEstagio.count({ where: { sessaoId: id } }));
export const event = (tx: Transaction, data: Prisma.EventoAgendaUncheckedCreateInput) => tx.eventoAgenda.create({ data });
export const links = (id: string, tx = prisma as Transaction) => tx.vinculoEstagio.findMany({ where: { estagioId: id }, include: { matricula: { select: { aluno: { select: { id: true, nome: true } } } } }, orderBy: { id: 'asc' } });
export const frequencies = (id: string, tx = prisma as Transaction) => tx.frequenciaSessao.findMany({ where: { sessaoId: id } });
export const attendance = (tx: Transaction, sessaoId: string, vinculoId: string) => tx.frequenciaSessao.findUnique({ where: { sessaoId_vinculoId: { sessaoId, vinculoId } } });
export const attendanceByStudent = (tx: Transaction, sessaoId: string, alunoId: string) => tx.frequenciaSessao.findFirst({ where: { sessaoId, vinculo: { alunoId } }, select: { vinculoId: true } });
export const frequencyLinks = (tx: Transaction, instituicaoId: string, estagioId: string, ids: string[]) => tx.vinculoEstagio.findMany({ where: { instituicaoId, estagioId, id: { in: ids } }, select: { id: true, alunoId: true } });
export async function lockStudents(tx: Transaction, ids: string[]) { for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${id}::uuid FOR UPDATE`; }
export const saveAttendance = (tx: Transaction, sessaoId: string, vinculoId: string, create: Prisma.FrequenciaSessaoUncheckedCreateInput) => tx.frequenciaSessao.upsert({ where: { sessaoId_vinculoId: { sessaoId, vinculoId } }, create, update: { situacao: create.situacao, motivo: create.motivo ?? null, versao: { increment: 1 }, professoraId: create.professoraId } });
export const sessionRecords = (id: string, tx = prisma as Transaction) => tx.registroEstagio.findMany({ where: { sessaoId: id, status: { not: 'cancelado' } }, select: { id: true, alunoId: true, versao: true, status: true, aprovacoes: { where: { reabertura: null }, select: { versao: true } } } });
export const history = (sessaoId: string, pagina: number) => prisma.eventoAgenda.findMany({ where: { sessaoId }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 50, skip: (pagina - 1) * 50 });
export const plannedRecord = (tx: Transaction, estagioId: string, vinculoId: string, data: Date, start: number, end: number) => tx.agendaSessao.findFirst({ where: { estagioId, data, cancelada: false, inicioMinuto: { lt: end }, fimMinuto: { gt: start } }, select: { id: true } });
