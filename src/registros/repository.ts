import type { Transaction } from '../lib/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/user-select.js';
import { recordScope } from './access.js';

export const findLink = (tx: Transaction, instituicaoId: string, id: string) => tx.vinculoEstagio.findFirst({ where: { id, instituicaoId } });
export async function lockLinkContext(tx: Transaction, ref: { id: string; alunoId: string; estagioId: string }) {
  await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${ref.alunoId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM estagio WHERE id = ${ref.estagioId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM vinculo_estagio WHERE id = ${ref.id}::uuid FOR UPDATE`;
  return tx.vinculoEstagio.findUniqueOrThrow({ where: { id: ref.id }, include: { estagio: true } });
}
export const findOverlap = (tx: Transaction, alunoId: string, data: Date, inicioMinuto: number, fimMinuto: number, id?: string) => tx.registroEstagio.findFirst({ where: { alunoId, data, status: { not: 'cancelado' }, inicioMinuto: { lt: fimMinuto }, fimMinuto: { gt: inicioMinuto }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
export const ensureSheet = (tx: Transaction, vinculoId: string, instituicaoId: string, alunoId: string) => tx.fichaEstagio.upsert({ where: { vinculoId }, update: {}, create: { vinculoId, instituicaoId, alunoId } });
export const insertRecord = (tx: Transaction, data: Prisma.RegistroEstagioUncheckedCreateInput) => tx.registroEstagio.create({ data });
export const insertEvent = (tx: Transaction, data: Prisma.EventoRegistroUncheckedCreateInput) => tx.eventoRegistro.create({ data });
export const findReference = (tx: Transaction, actor: Actor, id: string) => tx.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, include: { ficha: true } });
export const currentRecord = (tx: Transaction, id: string) => tx.registroEstagio.findUniqueOrThrow({ where: { id } });
export const updateRecord = (tx: Transaction, id: string, data: Prisma.RegistroEstagioUpdateInput) => tx.registroEstagio.update({ where: { id }, data });
export const findBatchReferences = (tx: Transaction, actor: Actor, ids: string[]) => tx.registroEstagio.findMany({ where: { AND: [recordScope(actor), { id: { in: ids } }] }, include: { ficha: true } });
export const readBatch = (tx: Transaction, ids: string[]) => tx.registroEstagio.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
export const insertApproval = (tx: Transaction, data: Prisma.AprovacaoRegistroUncheckedCreateInput) => tx.aprovacaoRegistro.create({ data });
export const currentApproval = (tx: Transaction, instituicaoId: string, registroId: string, versao: number) => tx.aprovacaoRegistro.findFirst({ where: { registroId, versao, instituicaoId, reabertura: null } });
export const insertReopening = (tx: Transaction, data: Prisma.ReaberturaAprovacaoUncheckedCreateInput) => tx.reaberturaAprovacao.create({ data });
export const readApprovalStatus = (tx: Transaction, actor: Actor, id: string) => tx.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, select: { status: true, versao: true } });
export const readApprovals = (tx: Transaction, instituicaoId: string, registroId: string, pagina: number) => tx.aprovacaoRegistro.findMany({ where: { registroId, instituicaoId }, include: { reabertura: true }, orderBy: { versao: 'desc' }, take: 50, skip: (pagina - 1) * 50 });
export const findStudent = (tx: Transaction, actor: Actor, id: string) => tx.usuario.findFirst({ where: { id, instituicaoId: actor.instituicaoId, perfil: 'aluno', ...(actor.perfil === 'professora' ? { matriculas: { some: { vinculos: { some: { estagio: { professoraId: actor.id } } } } } } : {}) }, select: { id: true, nome: true } });

export const approvalSheet = (tx: Transaction, id: string) => tx.fichaEstagio.findUniqueOrThrow({ where: { id: id }, select: {
      id: true,
      vinculo: { select: {
        id: true, iniciadoEm: true, encerradoEm: true,
        matricula: { select: { aluno: { select: { id: true, nome: true } } } },
        estagio: { select: {
          id: true, codigo: true, turma: { select: { id: true, codigo: true } },
          disciplina: { select: { id: true, codigo: true, nome: true, cargaHorariaTotal: true } },
          campoEstagio: { select: { id: true, nome: true } },
        } },
      } },
    } });
