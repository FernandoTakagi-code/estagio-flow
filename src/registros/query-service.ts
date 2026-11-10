import type { Actor } from '../auth/user-select.js';
import { transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import * as repository from './query-repository.js';
import { courseHours, summarizeCourse } from './course-hours.js';
import { presentRecord } from './service.js';

export function panel(actor: Actor) {
  return transaction(async (tx) => {
    const registros = await repository.panelGroups(tx, actor);
    const course = actor.perfil === 'aluno' ? summarizeCourse(await courseHours(tx, actor, actor.id)) : null;
    return { registros, cargaHorariaMinutos: course?.cargaHorariaMinutos ?? null, cargaHorariaVinculosMinutos: course?.cargaHorariaVinculosMinutos ?? null, minutosAprovadosCurriculo: course?.minutosAprovadosCurriculo ?? null, minutosRestantesCurriculo: course?.minutosRestantesCurriculo ?? null };
  }, { isolationLevel: 'RepeatableRead' });
}
export const listSheets = repository.listSheets;
export async function listRecords(actor: Actor, pagina: number, filters: Parameters<typeof repository.listRecords>[2]) {
  return (await repository.listRecords(actor, pagina, filters)).map(({ eventos, ficha, ...record }) => ({ ...presentRecord(record), fichaFechada: Boolean(ficha.fechamento), motivoDevolucao: record.status === 'devolvido' ? eventos[0]?.motivo ?? null : null }));
}
export async function findRecord(actor: Actor, id: string) {
  const record = await repository.findRecord(actor, id);
  if (!record) throw new HttpError(404, 'Registro não encontrado.');
  const { ficha, ...saved } = record;
  return { ...presentRecord(saved), fichaFechada: Boolean(ficha.fechamento) };
}
export async function history(actor: Actor, id: string, pagina: number) {
  await findRecord(actor, id);
  return repository.history(actor.instituicaoId, id, pagina);
}
