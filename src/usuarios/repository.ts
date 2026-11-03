import { prisma } from '../lib/prisma.js';
import { transaction } from '../lib/transaction.js';
import { publicUserSelect } from '../auth/user-select.js';
import type { Prisma } from '../generated/prisma/client.js';

export function searchUsers(instituicaoId: string, query: { pagina: number; busca: string; perfil?: 'aluno' | 'professora' | 'coordenacao'; cadastros?: '1'; ativo?: 'true' | 'false' }) {
  const where: Prisma.UsuarioWhereInput = { instituicaoId, ...(query.cadastros ? { NOT: { perfil: 'coordenacao' } } : {}), ...(query.ativo ? { ativo: query.ativo === 'true' } : {}), ...(query.perfil ? { perfil: query.perfil } : {}), ...(query.busca ? { OR: [{ nome: { contains: query.busca, mode: 'insensitive' } }, { email: { contains: query.busca, mode: 'insensitive' } }] } : {}) };
  return transaction(async (tx) => ({
    total: await tx.usuario.count({ where }),
    usuarios: await tx.usuario.findMany({ where, select: { ...publicUserSelect, senhaHash: true, matriculas: { where: { encerradoEm: null }, select: { id: true, turmaId: true, turma: { select: { id: true, codigo: true } } }, take: 1 } }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }], take: 50, skip: (query.pagina - 1) * 50 }),
  }), { isolationLevel: 'RepeatableRead' });
}
export const findPerson = (instituicaoId: string, id: string) => prisma.usuario.findFirst({ where: { instituicaoId, id }, select: { ...publicUserSelect, senhaHash: true, matriculas: { where: { encerradoEm: null }, select: { id: true, turmaId: true, turma: { select: { id: true, codigo: true } } }, take: 1 } } });
