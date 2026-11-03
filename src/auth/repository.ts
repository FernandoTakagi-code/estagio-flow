import { prisma } from '../lib/prisma.js';
import type { Transaction } from '../lib/transaction.js';
import type { Prisma } from '../generated/prisma/client.js';
import { publicUserSelect } from './user-select.js';

export const findCredentials = (email: string) => prisma.usuario.findUnique({ where: { email } });
export const findSessionUser = (id: string) => prisma.usuario.findUnique({ where: { id }, select: { ...publicUserSelect, tokenVersao: true, senhaHash: true } });
export const findInvite = (tokenHash: string) => prisma.conviteUsuario.findUnique({ where: { tokenHash } });
export const insertUser = (tx: Transaction, data: Prisma.UsuarioUncheckedCreateInput) => tx.usuario.create({ data, select: publicUserSelect });
export const insertCoordinator = (data: Prisma.UsuarioUncheckedCreateInput) => prisma.usuario.create({ data, select: publicUserSelect });
export const insertInvite = (tx: Transaction, data: Prisma.ConviteUsuarioUncheckedCreateInput) => tx.conviteUsuario.create({ data });
export const lockPendingUser = (tx: Transaction, instituicaoId: string, id: string) => tx.usuario.updateMany({ where: { id, instituicaoId, perfil: { in: ['aluno', 'professora'] }, ativo: true, senhaHash: null }, data: { atualizadoEm: new Date() } });
export const revokeInvites = (tx: Transaction, usuarioId: string) => tx.conviteUsuario.updateMany({ where: { usuarioId, usadoEm: null, revogadoEm: null }, data: { revogadoEm: new Date() } });
export const activatePendingUser = (tx: Transaction, id: string, senhaHash: string) => tx.usuario.updateMany({ where: { id, ativo: true, senhaHash: null }, data: { senhaHash, tokenVersao: { increment: 1 } } });
export const consumeInvite = (tx: Transaction, id: string, tokenHash: string) => tx.conviteUsuario.updateMany({ where: { id, tokenHash, usadoEm: null, revogadoEm: null, expiraEm: { gt: new Date() } }, data: { usadoEm: new Date() } });
export const updateActive = (tx: Transaction, instituicaoId: string, id: string, ativo: boolean) => tx.usuario.updateMany({ where: { id, instituicaoId, perfil: { in: ['aluno', 'professora'] } }, data: { ativo, tokenVersao: { increment: 1 } } });
export const findPublicUser = (tx: Transaction, id: string) => tx.usuario.findUniqueOrThrow({ where: { id }, select: publicUserSelect });
export const invalidateSessions = (id: string) => prisma.usuario.update({ where: { id }, data: { tokenVersao: { increment: 1 } } });
