import type { Actor } from '../auth/user-select.js';
import type { Transaction } from '../lib/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
import { sheetScope } from './access.js';

export const reference = (tx: Transaction, actor: Actor, id: string) => tx.fichaEstagio.findFirst({ where: { ...sheetScope(actor), id }, select: { vinculoId: true } });
export async function lockSheet(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM ficha_estagio WHERE id = ${id}::uuid FOR UPDATE`;
}
export const detail = (tx: Transaction, id: string) => tx.fichaEstagio.findUniqueOrThrow({ where: { id }, include: {
  fechamento: true,
  vinculo: { include: { estagio: { include: { disciplina: true, campoEstagio: true, turma: true } }, matricula: { include: { aluno: { select: { id: true, nome: true } } } } } },
  registros: { orderBy: [{ data: 'asc' }, { inicioMinuto: 'asc' }, { id: 'asc' }], include: { aprovacoes: { include: { reabertura: true }, orderBy: { versao: 'desc' } } } },
} });
export const insert = (tx: Transaction, data: Prisma.FichaFechamentoUncheckedCreateInput) => tx.fichaFechamento.create({ data });
export const closed = (tx: Transaction, vinculoId: string) => tx.fichaEstagio.findUnique({ where: { vinculoId }, select: { fechamento: { select: { id: true } } } });
