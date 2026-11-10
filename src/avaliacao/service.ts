import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/user-select.js';
import { transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import { findLink, lockLinkContext } from '../registros/repository.js';
import * as repository from './repository.js';

export const criterios = ['Iniciativa', 'Assiduidade e pontualidade', 'Destreza manual', 'Segurança', 'Postura profissional', 'Organização do material utilizado', 'Comunicação e humanização da assistência de enfermagem', 'Evolução de enfermagem', 'Trabalho em equipe'];
const grade = z.string().regex(/^(?:[0-9](?:\.[0-9]{1,2})?|10(?:\.0{1,2})?)$/, 'Informe nota de 0 a 10, com até duas casas decimais.');
export const assessmentSchema = z.strictObject({ notas: z.array(grade).length(9), versaoAnterior: z.number().int().min(0), confirmar: z.literal(true), motivo: z.string().trim().min(1).max(1000).optional() });
export function result(notas: Prisma.Decimal[]) {
  const soma = notas.reduce((sum, n) => sum.plus(n), new Prisma.Decimal(0));
  return { media: soma.div(9).toFixed(2, Prisma.Decimal.ROUND_HALF_UP), aprovadoNaAvaliacao: soma.gte(63) };
}
const present = (item: Awaited<ReturnType<typeof repository.insert>>) => ({ ...item, notas: item.notas.map((n) => n.toFixed(2)), ...result(item.notas) });
export async function read(actor: Actor, id: string, pagina: number) {
  return transaction(async (tx) => {
    if (!await repository.sheet(tx, actor, id)) throw new HttpError(404, 'Ficha não encontrada.');
    const vigente = await repository.latest(tx, id);
    return { criterios, vigente: vigente ? present(vigente) : null, historico: (await repository.list(tx, id, pagina)).map(present), pagina, porPagina: 20 };
  }, { isolationLevel: 'RepeatableRead' });
}
export async function publish(actor: Actor, id: string, input: z.infer<typeof assessmentSchema>) {
  if (actor.perfil !== 'professora') throw new HttpError(403, 'Somente a professora responsável publica a avaliação.');
  if (!actor.coren?.trim()) throw new HttpError(409, 'Cadastre o COREN antes de publicar.');
  const coren = actor.coren.trim();
  return transaction(async (tx) => {
    const sheet = await repository.sheet(tx, actor, id);
    if (!sheet) throw new HttpError(404, 'Ficha não encontrada.');
    const ref = await findLink(tx, actor.instituicaoId, sheet.vinculoId);
    if (!ref) throw new HttpError(404, 'Vínculo não encontrado.');
    const link = await lockLinkContext(tx, ref);
    if (link.estagio.professoraId !== actor.id) throw new HttpError(404, 'Ficha não encontrada.');
    const current = await repository.latest(tx, id);
    if ((current?.versao ?? 0) !== input.versaoAnterior) throw new HttpError(409, 'Avaliação alterada. Atualize antes de publicar.');
    if (current && !input.motivo) throw new HttpError(400, 'Informe o motivo da correção.');
    const notas = input.notas.map((n) => new Prisma.Decimal(n));
    const snapshot = { regra: 'avaliacao_por_vinculo_mvp_v1', criterios, notas: notas.map((n) => n.toFixed(2)), ...result(notas),
      aluno: sheet.vinculo.matricula.aluno, turma: sheet.vinculo.estagio.turma.codigo,
      disciplina: sheet.vinculo.estagio.disciplina.nome, local: sheet.vinculo.estagio.campoEstagio.nome,
      professora: { id: actor.id, nome: actor.nome, coren }, minimo: '7.00', pesosIguais: true };
    return present(await repository.insert(tx, { instituicaoId: actor.instituicaoId, fichaId: id, professoraId: actor.id,
      notas, versao: (current?.versao ?? 0) + 1, motivo: input.motivo, snapshot }));
  });
}
export async function monitoring(actor: Actor, pagina: number) {
  if (actor.perfil !== 'coordenacao') throw new HttpError(403, 'Somente a coordenação acessa o acompanhamento geral.');
  return transaction(async (tx) => ({ pagina, porPagina: 50, vinculos: (await repository.monitoring(tx, actor, pagina)).map((row) => {
    const records = row.ficha?.registros ?? [];
    const approved = records.filter((r) => r.status === 'aprovado' && r.aprovacoes.some((a) => a.versao === r.versao));
    const evaluation = row.ficha?.avaliacoes[0];
    return { id: row.id, aluno: row.matricula.aluno, disciplina: row.estagio.disciplina, turma: row.estagio.turma.codigo, professora: row.estagio.professora.nome,
      fichaId: row.ficha?.id ?? null, encerrado: Boolean(row.encerradoEm), fichaFechada: Boolean(row.ficha?.fechamento),
      minutosAprovados: approved.reduce((sum, r) => sum + r.duracaoMinutos, 0), pendentes: records.filter((r) => r.status !== 'cancelado' && !approved.includes(r)).length,
      avaliacao: evaluation ? { versao: evaluation.versao, ...result(evaluation.notas) } : null };
  }) }), { isolationLevel: 'RepeatableRead' });
}
