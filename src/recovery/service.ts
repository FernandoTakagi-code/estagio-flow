import { randomBytes, createHash } from 'node:crypto';
import { transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { queueAccessEmail } from '../email/service.js';
import { emailConfig } from '../email/config.js';
import * as repository from './repository.js';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const invalid = () => new HttpError(400, 'Link inválido ou expirado. Solicite uma nova recuperação.');
export async function requestRecovery(email: string) {
  if (emailConfig().mode === 'disabled') throw new HttpError(503, 'Recuperação por e-mail indisponível. Fale com a coordenação.');
  const reference = await repository.findUser(email); if (!reference) return;
  await transaction(async (tx) => {
    const user = await repository.lock(tx, reference.id);
    if (!user?.ativo || !user.senhaHash || await repository.recent(tx, user.id)) return;
    await repository.revoke(tx, user.id);
    const token = randomBytes(32).toString('hex'); const expiraEm = new Date(Date.now() + 30 * 60_000);
    await repository.insert(tx, { usuarioId: user.id, tokenHash: digest(token), expiraEm });
    await queueAccessEmail(tx, user, 'recuperacao', token, expiraEm);
  });
}
export async function resetPassword(token: string, password: string) {
  const reference = await repository.find(digest(token));
  if (!reference || reference.usadoEm || reference.revogadoEm || reference.expiraEm <= new Date()) throw invalid();
  const senhaHash = await hashPassword(password);
  await transaction(async (tx) => {
    const user = await repository.lock(tx, reference.usuarioId);
    if (!user?.ativo || !user.senhaHash) throw invalid();
    if ((await repository.consume(tx, reference.id)).count !== 1) throw invalid();
    await repository.password(tx, user.id, senhaHash); await repository.revoke(tx, user.id);
  });
}
