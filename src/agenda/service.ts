import type { z } from 'zod';
import type { Actor } from '../auth/user-select.js';
import type { Prisma, AgendaSessao } from '../generated/prisma/client.js';
import { transaction, type Transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import { lockContext } from '../registros/service.js';
import { minutes } from '../registros/schemas.js';
import * as repository from './repository.js';
import type { createSchema, editSchema, frequencySchema, querySchema } from './schemas.js';

import { localDay, isoDay, eligible } from './dates.js';

const clock = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
export function present<T extends AgendaSessao>(session: T) { return { ...session, data: isoDay(session.data), horaInicio: clock(session.inicioMinuto), horaFim: clock(session.fimMinuto), duracaoMinutos: session.fimMinuto - session.inicioMinuto }; }
function editor(actor: Actor) { if (actor.perfil === 'aluno') throw new HttpError(403, 'Somente coordenação e professora responsável organizam o cronograma.'); }
const payload = (input: { data: string; horaInicio: string; horaFim: string }) => ({ data: new Date(`${input.data}T00:00:00Z`), inicioMinuto: minutes(input.horaInicio), fimMinuto: minutes(input.horaFim) });
async function audit(tx: Transaction, actor: Actor, session: AgendaSessao, acao: string, extra: object = {}) { await repository.event(tx, { instituicaoId: actor.instituicaoId, autorId: actor.id, sessaoId: session.id, acao, snapshot: JSON.parse(JSON.stringify({ sessao: present(session), ...extra })) as Prisma.InputJsonValue }); }
async function groupForEdit(actor: Actor, id: string, tx: Transaction) {
  editor(actor); const ref = await repository.findGroup(actor, id, tx);
  if (!ref) throw new HttpError(404, 'Grupo de estágio não encontrado.');
  await repository.lockTeacherGroup(tx, ref.professora.id, ref.id);
  const group = await repository.findGroup(actor, id, tx);
  if (!group || group.encerradoEm || !group.professora.ativo) throw new HttpError(409, 'Grupo encerrado ou professora indisponível.');
  return group;
}
async function checkSlot(tx: Transaction, teacherId: string, data: ReturnType<typeof payload>, id?: string) {
  if (await repository.overlapping(tx, teacherId, data.data, data.inicioMinuto, data.fimMinuto, id)) throw new HttpError(409, 'O horário coincide com outra sessão da professora, inclusive em outro grupo.');
}
export async function create(actor: Actor, input: z.infer<typeof createSchema>) {
  editor(actor);
  return transaction(async (tx) => {
    const group = await groupForEdit(actor, input.estagioId, tx); const data = payload(input);
    await checkSlot(tx, group.professora.id, data);
    const session = await repository.insertSession(tx, { ...data, estagioId: group.id, instituicaoId: actor.instituicaoId, criadoPorId: actor.id });
    await audit(tx, actor, session, 'criada'); return present(session);
  });
}
export async function change(actor: Actor, id: string, versao: number, motivo: string, input?: z.infer<typeof editSchema>) {
  editor(actor);
  return transaction(async (tx) => {
    const ref = await repository.findSession(actor, id, tx); if (!ref) throw new HttpError(404, 'Sessão não encontrada.');
    const group = await groupForEdit(actor, ref.estagioId, tx); await repository.lockSession(tx, id);
    const current = await repository.findSession(actor, id, tx);
    if (!current || current.cancelada || current.versao !== versao) throw new HttpError(409, 'Sessão alterada ou cancelada. Atualize a consulta.');
    if (await repository.touched(tx, id)) throw new HttpError(409, 'Sessão com frequência ou registros não pode ser alterada nem cancelada.');
    const data = input ? payload(input) : undefined;
    if (data) {
      await checkSlot(tx, group.professora.id, data, id);

    }
    const session = await repository.updateSession(tx, id, { ...data, cancelada: !input, versao: { increment: 1 } });
    await audit(tx, actor, session, input ? 'alterada' : 'cancelada', { motivo, anterior: present(current) }); return present(session);
  });
}
export async function list(actor: Actor, query: z.infer<typeof querySchema>) {
  return (await repository.listSessions(actor, { estagioId: query.estagioId, ...((query.de || query.ate) ? { data: { ...(query.de ? { gte: new Date(`${query.de}T00:00:00Z`) } : {}), ...(query.ate ? { lte: new Date(`${query.ate}T00:00:00Z`) } : {}) } } : {}) }, query.pagina)).map(present);
}

export async function detail(actor: Actor, id: string) {
  const session = await repository.findSession(actor, id); if (!session) throw new HttpError(404, 'Sessão não encontrada.');
  const [links, frequencies, records] = await Promise.all([repository.links(session.estagioId), repository.frequencies(id), repository.sessionRecords(id)]);
  const alunos = links.filter((link) => eligible(link, session) && (actor.perfil !== 'aluno' || link.alunoId === actor.id)).map((link) => {
    const frequency = frequencies.find((item) => item.vinculoId === link.id); const record = records.find((item) => item.alunoId === link.alunoId);
    return { vinculoId: link.id, alunoId: link.alunoId, nome: link.matricula.aluno.nome, frequencia: frequency ? { id: frequency.id, versao: frequency.versao, situacao: frequency.situacao, motivo: frequency.motivo } : null, registro: record ? { id: record.id, status: record.status, aprovado: record.status === 'aprovado' && record.aprovacoes.some((approval) => approval.versao === record.versao) } : null };
  });
  return { sessao: present(session), alunos };
}
async function markInside(tx: Transaction, actor: Actor, id: string, input: z.infer<typeof frequencySchema>) {
  const link = await lockContext(tx, actor, input.vinculoId); await repository.lockSession(tx, id);
  const session = await repository.findSession(actor, id, tx);
  if (!session || session.estagioId !== link.estagioId || !eligible(link, session)) throw new HttpError(404, 'Sessão ou vínculo não disponível.');
  if (session.cancelada || isoDay(session.data) > localDay(new Date())) throw new HttpError(409, 'Não lance frequência em sessão futura ou cancelada.');
  const current = await repository.attendance(tx, id, link.id);
  if ((current?.versao ?? 0) !== input.versao) throw new HttpError(409, 'Frequência alterada. Atualize a chamada antes de salvar.');
  const other = await repository.attendanceByStudent(tx, id, link.alunoId);
  if (other && other.vinculoId !== link.id) throw new HttpError(409, 'O aluno já tem frequência nesta sessão em outro vínculo.');
  if (current && !input.motivo) throw new HttpError(400, 'Informe o motivo da correção da frequência.');
  if (input.situacao !== 'presente' && (await repository.sessionRecords(id, tx)).some((record) => record.alunoId === link.alunoId)) throw new HttpError(409, 'Existe registro ativo nesta sessão; resolva-o antes de lançar falta.');
  const frequency = await repository.saveAttendance(tx, id, link.id, { sessaoId: id, instituicaoId: actor.instituicaoId, estagioId: link.estagioId, vinculoId: link.id, situacao: input.situacao, motivo: input.motivo || null, professoraId: actor.id });
  await audit(tx, actor, session, 'frequencia', { anterior: current, frequencia: frequency }); return frequency;
}
export async function markBatch(actor: Actor, id: string, inputs: z.infer<typeof frequencySchema>[]) {
  if (actor.perfil !== 'professora') throw new HttpError(403, 'Somente a professora responsável lança a frequência.');
  return transaction(async (tx) => {
    const session = await repository.findSession(actor, id, tx);
    if (!session) throw new HttpError(404, 'Sessão não encontrada.');
    const refs = await repository.frequencyLinks(tx, actor.instituicaoId, session.estagioId, inputs.map((item) => item.vinculoId));
    if (refs.length !== inputs.length) throw new HttpError(404, 'Aluno não disponível nesta sessão.');
    if (new Set(refs.map((item) => item.alunoId)).size !== refs.length) throw new HttpError(400, 'Não repita o aluno na chamada.');
    // Lock every student first, in stable order, before acquiring group/link/session locks.
    await repository.lockStudents(tx, refs.map((item) => item.alunoId));
    const results = [];
    for (const input of inputs) results.push(await markInside(tx, actor, id, input));
    return results;
  }, { timeout: 20_000 });
}
export async function mark(actor: Actor, id: string, input: z.infer<typeof frequencySchema>) { return (await markBatch(actor, id, [input]))[0]!; }
export async function history(actor: Actor, id: string, pagina: number) { editor(actor); if (!await repository.findSession(actor, id)) throw new HttpError(404, 'Sessão não encontrada.'); return repository.history(id, pagina); }
