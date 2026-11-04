import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Transaction } from '../lib/transaction.js';
import { emailConfig } from './config.js';
import * as repository from './repository.js';

interface Content { to: string; subject: string; text: string }
const captured: (Content & { id: string })[] = [];
export const captureInbox = () => emailConfig().mode === 'capture' ? [...captured] : [];
export const clearCaptureInbox = () => { captured.length = 0; };
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
function encrypt(content: Content, key: Buffer) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.'); }
function decrypt(value: string, key: Buffer): Content { const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url')); const cipher = createDecipheriv('aes-256-gcm', key, iv!); cipher.setAuthTag(tag!); return JSON.parse(Buffer.concat([cipher.update(ciphertext!), cipher.final()]).toString('utf8')) as Content; }

export async function queueAccessEmail(tx: Transaction, user: { id: string; email: string }, kind: 'convite' | 'recuperacao', token: string, expiraEm: Date) {
  const config = emailConfig(); if (config.mode === 'disabled') return { estado: 'manual' as const };
  const link = `${config.base}/#${kind === 'convite' ? 'convite' : 'recuperacao'}=${token}`;
  const content = { to: user.email, subject: kind === 'convite' ? 'Seu convite para o Estágio Flow' : 'Recuperação de senha — Estágio Flow', text: `${kind === 'convite' ? 'A coordenação criou seu acesso. Defina sua senha pelo link:' : 'Recebemos uma solicitação de recuperação de senha. Se foi você, defina uma nova senha pelo link:'}\n\n${link}\n\nVálido até ${expiraEm.toISOString()}. Este link é pessoal e de uso único. Não o compartilhe.\nSe você não esperava esta mensagem, ignore-a. Não responda com sua senha.` };
  await repository.enqueue(tx, { id: randomUUID(), usuarioId: user.id, tipo: kind, referenciaHash: digest(token), conteudoCifrado: encrypt(content, config.key), expiraEm });
  return { estado: 'na_fila' as const };
}
export async function processEmails(limit = 20) {
  const config = emailConfig(); if (config.mode === 'disabled') return;
  for (let index = 0; index < limit; index++) {
    const message = await repository.claim(); if (!message) return;
    const owner = await repository.user(message.usuarioId);
    const reference = message.tipo === 'convite' ? await repository.invite(message.referenciaHash) : await repository.reset(message.referenciaHash);
    if (!owner?.ativo || !reference || reference.usadoEm || reference.revogadoEm || reference.expiraEm <= new Date() || message.expiraEm <= new Date() || !message.conteudoCifrado || message.tentativas > 5 || Date.now() - message.criadoEm.getTime() > 23 * 60 * 60 * 1000 || (message.tipo === 'convite' ? Boolean(owner.senhaHash) : !owner.senhaHash)) {
      await repository.finish(message.id, message.tentativas, { estado: 'cancelada', conteudoCifrado: null, codigoErro: 'referencia_indisponivel' }); continue;
    }
    try {
      const content = decrypt(message.conteudoCifrado, config.key);
      if (config.mode === 'capture') { if (!captured.some((item) => item.id === message.id)) { captured.push({ ...content, id: message.id }); if (captured.length > 100) captured.shift(); } }
      else {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `access/${message.id}` }, body: JSON.stringify({ from: config.from, to: [content.to], subject: content.subject, text: content.text }), signal: AbortSignal.timeout(10_000) });
        if (!response.ok) { await response.body?.cancel(); throw new Error('provider_failure'); }
        await response.body?.cancel();
        await delay(600); // Respect the provider's default send rate for imported invitations.
      }
      await repository.finish(message.id, message.tentativas, { estado: 'enviada', conteudoCifrado: null, codigoErro: null });
    } catch {
      await repository.finish(message.id, message.tentativas, { estado: message.tentativas >= 5 ? 'falha' : 'pendente', conteudoCifrado: message.tentativas >= 5 ? null : message.conteudoCifrado, codigoErro: 'falha_no_envio', disponivelEm: new Date(Date.now() + 30_000 * 2 ** message.tentativas) });
    }
  }
}
export function startEmailWorker(intervalMs = 5000) {
  emailConfig(); let running = false;
  const tick = async () => { if (running) return; running = true; try { await processEmails(); } catch { console.error('Fila de e-mails indisponível. Nova tentativa automática.'); } finally { running = false; } };
  const timer = setInterval(() => void tick(), intervalMs); timer.unref(); void tick();
  return () => clearInterval(timer);
}
