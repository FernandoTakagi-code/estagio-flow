import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { queueAccessEmail } from '../email/service.js';
import { validateAcknowledgement, recordAcknowledgement, type Acknowledgement } from '../legal/service.js';
import { transaction } from '../lib/transaction.js';
import * as repository from './repository.js';
import type { Actor } from './user-select.js';
export { publicUserSelect, type Actor } from './user-select.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { HttpError } from '../lib/errors.js';
import type { z } from 'zod';
import type { createUserSchema, adminSchema } from './schemas.js';
import type { Prisma } from '../generated/prisma/client.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const invalidInvite = () => new HttpError(400, 'Convite inválido ou expirado.');
let dummyHash: Promise<string> | undefined;

export async function authenticate(email: string, password: string) {
  const user = await repository.findCredentials(email);
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  const valid = await verifyPassword(password, user?.senhaHash ?? await dummyHash);
  if (!user?.ativo || !user.senhaHash || !valid) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }
  const { senhaHash: _hash, tokenVersao, criadoPorId: _creator, atualizadoEm: _updated, ...publicUser } = user;
  return { user: publicUser, tokenVersao };
}

export function prepareInvite(usuarioId: string, criadoPorId: string) {
  const token = randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return {
    data: { id: randomUUID(), usuarioId, criadoPorId, tokenHash: digest(token), expiraEm },
    publico: { token, expiraEm },
  };
}

async function addInvite(tx: Prisma.TransactionClient, usuarioId: string, criadoPorId: string) {
  const convite = prepareInvite(usuarioId, criadoPorId);
  await repository.insertInvite(tx, convite.data);
  return convite.publico;
}

export async function createUser(actor: Actor, data: z.infer<typeof createUserSchema>) {
  return transaction(async (tx) => {
    const usuario = await repository.insertUser(tx, { ...data, instituicaoId: actor.instituicaoId, criadoPorId: actor.id });
    const convite = await addInvite(tx, usuario.id, actor.id);
    const email = await queueAccessEmail(tx, usuario, 'convite', convite.token, convite.expiraEm);
    return { usuario, convite: { ...convite, email } };
  });
}

export async function reissueInvite(actor: Actor, id: string) {
  return transaction(async (tx) => {
    // The conditional update serializes reissue against activation and deactivation.
    const pending = await repository.lockPendingUser(tx, actor.instituicaoId, id);
    if (pending.count !== 1) throw new HttpError(404, 'Usuário pendente não encontrado.');
    await repository.revokeInvites(tx, id);
    const convite = await addInvite(tx, id, actor.id);
    const usuario = await repository.findPublicUser(tx, id);
    return { ...convite, email: await queueAccessEmail(tx, usuario, 'convite', convite.token, convite.expiraEm) };
  });
}

export async function acceptInvite(token: string, password: string, acknowledgement?: Acknowledgement) {
  const documents = validateAcknowledgement(acknowledgement);
  const tokenHash = digest(token);
  const invite = await repository.findInvite(tokenHash);
  if (!invite || invite.usadoEm || invite.revogadoEm || invite.expiraEm <= new Date()) throw invalidInvite();
  const senhaHash = await hashPassword(password);

  await transaction(async (tx) => {
    // Lock the user first in all invitation flows to avoid lock-order inversions.
    const activated = await repository.activatePendingUser(tx, invite.usuarioId, senhaHash);
    if (activated.count !== 1) throw invalidInvite();
    const consumed = await repository.consumeInvite(tx, invite.id, tokenHash);
    if (consumed.count !== 1) throw invalidInvite();
    await repository.revokeInvites(tx, invite.usuarioId);
    await recordAcknowledgement(tx, invite.usuarioId, 'convite', documents);
  });
}

export async function setUserActive(actor: Actor, id: string, ativo: boolean) {
  return transaction(async (tx) => {
    const updated = await repository.updateActive(tx, actor.instituicaoId, id, ativo);
    if (updated.count !== 1) throw new HttpError(404, 'Usuário não encontrado.');
    if (!ativo) {
      await repository.revokeInvites(tx, id);
    }
    return repository.findPublicUser(tx, id);
  });
}

export async function createCoordinator(data: z.infer<typeof adminSchema>) {
  const senhaHash = await hashPassword(data.senha);
  return repository.insertCoordinator({ nome: data.nome, email: data.email, instituicaoId: data.instituicaoId, senhaHash, perfil: 'coordenacao' });
}

export async function logout(actor: Actor) { await repository.invalidateSessions(actor.id); }
