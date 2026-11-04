import { prisma } from '../lib/prisma.js';
import type { Transaction } from '../lib/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
export const receipts = (usuarioId: string, tx: Transaction = prisma) => tx.registroLegal.findMany({ where: { usuarioId }, orderBy: { registradoEm: 'desc' } });
export const record = (tx: Transaction, data: Prisma.RegistroLegalUncheckedCreateInput) => tx.registroLegal.upsert({ where: { usuarioId_tipo_hashDocumento: { usuarioId: data.usuarioId, tipo: data.tipo, hashDocumento: data.hashDocumento } }, update: {}, create: data });
