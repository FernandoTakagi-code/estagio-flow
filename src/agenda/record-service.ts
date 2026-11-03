import type { Transaction } from '../lib/transaction.js';
import type { Actor } from '../auth/user-select.js';
import { HttpError } from '../lib/errors.js';
import { minutes } from '../registros/schemas.js';
import { isoDay, eligible } from './dates.js';
import * as repository from './repository.js';

export async function validateUnscheduledRecord(tx: Transaction, estagioId: string, vinculoId: string, input: { data: string; horaInicio: string; horaFim: string }) {
  if (await repository.plannedRecord(tx, estagioId, vinculoId, new Date(`${input.data}T00:00:00Z`), minutes(input.horaInicio), minutes(input.horaFim))) throw new HttpError(409, 'Existe uma sessão no cronograma nesse horário. Abra a sessão e use Registrar atividades após a confirmação da presença.');
}
export async function validateRecordSession(tx: Transaction, actor: Actor, id: string, vinculoId: string, input: { data: string; horaInicio: string; horaFim: string }) {
  await repository.lockSession(tx, id); const session = await repository.findSession(actor, id, tx);
  const link = session ? (await repository.links(session.estagioId, tx)).find((item) => item.id === vinculoId) : undefined;
  if (!session || !link || link.alunoId !== actor.id || session.cancelada || !eligible(link, session)) throw new HttpError(409, 'Sessão não disponível para este vínculo.');
  if ((await repository.attendance(tx, id, vinculoId))?.situacao !== 'presente') throw new HttpError(409, 'A professora precisa confirmar a presença antes do registro desta sessão.');
  if (input.data !== isoDay(session.data) || minutes(input.horaInicio) !== session.inicioMinuto || minutes(input.horaFim) !== session.fimMinuto) throw new HttpError(409, 'Use a data e os horários completos da sessão selecionada.');
}
