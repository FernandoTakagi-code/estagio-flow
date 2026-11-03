import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Transaction } from '../lib/transaction.js';

export const usedEmails = (emails: string[]) => prisma.usuario.findMany({ where: { email: { in: emails } }, select: { email: true } });
export const clearExpired = (tx: Transaction, instituicaoId: string, criadoPorId: string, now: Date) => tx.importacaoAlunos.updateMany({ where: { instituicaoId, criadoPorId, expiraEm: { lte: now }, confirmadaEm: null }, data: { dados: Prisma.DbNull } });
export const insertPreview = (tx: Transaction, data: Prisma.ImportacaoAlunosUncheckedCreateInput) => tx.importacaoAlunos.create({ data, select: { id: true } });
export const findPreview = (tx: Transaction, instituicaoId: string, criadoPorId: string, id: string) => tx.importacaoAlunos.findFirst({ where: { id, instituicaoId, criadoPorId } });
export const claimPreview = (tx: Transaction, instituicaoId: string, criadoPorId: string, id: string) => tx.importacaoAlunos.updateMany({ where: { id, instituicaoId, criadoPorId, confirmadaEm: null, expiraEm: { gt: new Date() } }, data: { confirmadaEm: new Date(), dados: Prisma.DbNull } });
export const insertStudents = (tx: Transaction, data: Prisma.UsuarioCreateManyInput[]) => tx.usuario.createMany({ data });
export const insertInvitations = (tx: Transaction, data: Prisma.ConviteUsuarioCreateManyInput[]) => tx.conviteUsuario.createMany({ data });
