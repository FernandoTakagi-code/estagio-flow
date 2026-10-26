import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { HttpError } from '../lib/errors.js';
import type { z } from 'zod';
import type { createUserSchema, adminSchema } from './schemas.js';
import type { Prisma } from '../generated/prisma/client.js';

export const publicUserSelect = {
  id: true, instituicaoId: true, nome: true, email: true,
  perfil: true, coren: true, ativo: true, criadoEm: true,
} satisfies Prisma.UsuarioSelect;

export type Actor = Prisma.UsuarioGetPayload<{ select: typeof publicUserSelect }>;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const invalidInvite = () => new HttpError(400, 'Convite inválido ou expirado.');
let dummyHash: Promise<string> | undefined;

export async function authenticate(email: string, password: string) {
  const user = await prisma.usuario.findUnique({ where: { email } });
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  const valid = await verifyPassword(password, user?.senhaHash ?? await dummyHash);
  if (!user?.ativo || !user.senhaHash || !valid) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }
  const { senhaHash: _hash, tokenVersao, criadoPorId: _creator, atualizadoEm: _updated, ...publicUser } = user;
  return { user: publicUser, tokenVersao };
}

async function addInvite(tx: Prisma.TransactionClient, usuarioId: string, criadoPorId: string) {
  const token = randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await tx.conviteUsuario.create({
    data: { usuarioId, criadoPorId, tokenHash: digest(token), expiraEm },
  });
  return { token, expiraEm };
}

export async function createUser(actor: Actor, data: z.infer<typeof createUserSchema>) {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { ...data, instituicaoId: actor.instituicaoId, criadoPorId: actor.id },
      select: publicUserSelect,
    });
    const convite = await addInvite(tx, usuario.id, actor.id);
    return { usuario, convite };
  });
}

export async function reissueInvite(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    // The conditional update serializes reissue against activation and deactivation.
    const pending = await tx.usuario.updateMany({
      where: { id, instituicaoId: actor.instituicaoId, perfil: { in: ['aluno', 'professora'] }, ativo: true, senhaHash: null },
      data: { atualizadoEm: new Date() },
    });
    if (pending.count !== 1) throw new HttpError(404, 'Usuário pendente não encontrado.');
    await tx.conviteUsuario.updateMany({
      where: { usuarioId: id, usadoEm: null, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    return addInvite(tx, id, actor.id);
  });
}

export async function acceptInvite(token: string, password: string) {
  const tokenHash = digest(token);
  const invite = await prisma.conviteUsuario.findUnique({ where: { tokenHash } });
  if (!invite || invite.usadoEm || invite.revogadoEm || invite.expiraEm <= new Date()) throw invalidInvite();
  const senhaHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    // Lock the user first in all invitation flows to avoid lock-order inversions.
    const activated = await tx.usuario.updateMany({
      where: { id: invite.usuarioId, ativo: true, senhaHash: null },
      data: { senhaHash, tokenVersao: { increment: 1 } },
    });
    if (activated.count !== 1) throw invalidInvite();
    const consumed = await tx.conviteUsuario.updateMany({
      where: { id: invite.id, tokenHash, usadoEm: null, revogadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date() },
    });
    if (consumed.count !== 1) throw invalidInvite();
    await tx.conviteUsuario.updateMany({
      where: { usuarioId: invite.usuarioId, usadoEm: null, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  });
}

export async function setUserActive(actor: Actor, id: string, ativo: boolean) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.usuario.updateMany({
      where: { id, instituicaoId: actor.instituicaoId, perfil: { in: ['aluno', 'professora'] } },
      data: { ativo, tokenVersao: { increment: 1 } },
    });
    if (updated.count !== 1) throw new HttpError(404, 'Usuário não encontrado.');
    if (!ativo) {
      await tx.conviteUsuario.updateMany({
        where: { usuarioId: id, usadoEm: null, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
    }
    return tx.usuario.findUniqueOrThrow({ where: { id }, select: publicUserSelect });
  });
}

export async function createCoordinator(data: z.infer<typeof adminSchema>) {
  const senhaHash = await hashPassword(data.senha);
  return prisma.usuario.create({
    data: { nome: data.nome, email: data.email, instituicaoId: data.instituicaoId, senhaHash, perfil: 'coordenacao' },
    select: publicUserSelect,
  });
}
