import { createHash } from 'node:crypto';
import type { Actor } from '../auth/user-select.js';
import type { Prisma } from '../generated/prisma/client.js';
import { transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import * as repository from './closure-repository.js';
import { findLink, lockLinkContext } from './repository.js';
import { presentRecord } from './service.js';

type Sheet = Awaited<ReturnType<typeof repository.detail>>;
function summarize(sheet: Sheet) {
  const approved = sheet.registros.filter((record) => record.status === 'aprovado' && record.aprovacoes.some((approval) => approval.versao === record.versao && !approval.reabertura));
  const pendentes = sheet.registros.filter((record) => record.status !== 'cancelado' && !approved.includes(record)).length;
  const totalMinutos = approved.reduce((total, record) => total + record.duracaoMinutos, 0);
  const dataUltimoDia = approved.at(-1)?.data.toISOString().slice(0, 10) ?? null;
  const revisao = createHash('sha256').update(JSON.stringify(sheet.registros.map(({ id, versao, status }) => ({ id, versao, status })))).digest('hex');
  return { approved, pendentes, totalMinutos, dataUltimoDia, revisao };
}
function present(sheet: Sheet) {
  const { pendentes, totalMinutos, dataUltimoDia, revisao } = summarize(sheet);
  return { id: sheet.id, aluno: sheet.vinculo.matricula.aluno,
    disciplina: { nome: sheet.vinculo.estagio.disciplina.nome, cargaHorariaTotal: sheet.vinculo.estagio.disciplina.cargaHorariaTotal },
    turma: sheet.vinculo.estagio.turma.codigo, local: sheet.vinculo.estagio.campoEstagio.nome,
    pendentes, totalMinutos, dataUltimoDia, revisao, fechamento: sheet.fechamento };
}
export async function sheetDetail(actor: Actor, id: string) {
  return transaction(async (tx) => {
    if (!await repository.reference(tx, actor, id)) throw new HttpError(404, 'Ficha não encontrada.');
    return present(await repository.detail(tx, id));
  }, { isolationLevel: 'RepeatableRead' });
}
export async function closeSheet(actor: Actor, id: string, revisao: string) {
  if (actor.perfil !== 'professora') throw new HttpError(403, 'Somente a professora responsável fecha a ficha.');
  if (!actor.coren?.trim()) throw new HttpError(409, 'Cadastre o COREN da professora antes de fechar a ficha.');
  const coren = actor.coren.trim();
  return transaction(async (tx) => {
    const ref = await repository.reference(tx, actor, id);
    if (!ref) throw new HttpError(404, 'Ficha não encontrada.');
    const linkRef = await findLink(tx, actor.instituicaoId, ref.vinculoId);
    if (!linkRef) throw new HttpError(404, 'Vínculo não encontrado.');
    // Same student -> group -> link order used by records and transfers.
    const link = await lockLinkContext(tx, linkRef);
    if (link.estagio.professoraId !== actor.id) throw new HttpError(404, 'Ficha não encontrada.');
    await repository.lockSheet(tx, id);
    const sheet = await repository.detail(tx, id);
    if (sheet.fechamento) throw new HttpError(409, 'Esta ficha já foi fechada.');
    const summary = summarize(sheet);
    if (summary.revisao !== revisao) throw new HttpError(409, 'A ficha foi alterada. Atualize o resumo antes de confirmar.');
    if (summary.pendentes) throw new HttpError(409, 'Resolva os registros pendentes antes do fechamento.');
    if (!summary.approved.length || !summary.dataUltimoDia) throw new HttpError(409, 'A ficha precisa ter registros aprovados para ser fechada.');
    const snapshot = { regra: 'por_vinculo_mvp', fichaId: id, vinculoId: ref.vinculoId,
      aluno: sheet.vinculo.matricula.aluno, turma: sheet.vinculo.estagio.turma.codigo,
      disciplina: { id: sheet.vinculo.disciplinaId, nome: sheet.vinculo.estagio.disciplina.nome, cargaHorariaTotal: sheet.vinculo.estagio.disciplina.cargaHorariaTotal },
      local: { id: sheet.vinculo.estagio.campoEstagioId, nome: sheet.vinculo.estagio.campoEstagio.nome },
      professora: { id: actor.id, nome: actor.nome, coren, papeis: ['preceptora', 'RT'] },
      totalMinutos: summary.totalMinutos, dataUltimoDia: summary.dataUltimoDia,
      registros: summary.approved.map(({ aprovacoes, ...record }) => ({ registro: presentRecord(record), aprovacao: aprovacoes.find((approval) => approval.versao === record.versao && !approval.reabertura) })),
    };
    return repository.insert(tx, { instituicaoId: actor.instituicaoId, fichaId: id, professoraId: actor.id,
      coren, dataUltimoDia: new Date(`${summary.dataUltimoDia}T00:00:00Z`), totalMinutos: summary.totalMinutos, revisao,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue });
  });
}
