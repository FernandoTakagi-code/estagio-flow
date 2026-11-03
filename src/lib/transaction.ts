import { prisma } from './prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

export type Transaction = Prisma.TransactionClient;
export function transaction<T>(work: (tx: Transaction) => Promise<T>, options?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }) {
  return prisma.$transaction(work, options);
}
