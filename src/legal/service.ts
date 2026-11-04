import { z } from 'zod';
import { legalConfig, type LegalConfig } from './config.js';
import type { Transaction } from '../lib/transaction.js';
import { transaction } from '../lib/transaction.js';
import { HttpError } from '../lib/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import * as repository from './repository.js';
export const acknowledgementSchema = z.object({ aceitoTermos: z.literal(true), cienciaPrivacidade: z.literal(true), termosHash: z.string().regex(/^[a-f0-9]{64}$/), privacidadeHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type Acknowledgement = z.infer<typeof acknowledgementSchema>;
export function validateAcknowledgement(input?: Acknowledgement, config = legalConfig()) {
  if (!config.exigido) return config;
  if (!input || input.termosHash !== config.documentos.find((doc) => doc.tipo === 'termos')!.hash || input.privacidadeHash !== config.documentos.find((doc) => doc.tipo === 'privacidade')!.hash) throw new HttpError(428, 'Confira e aceite os documentos vigentes para continuar.');
  return config;
}
export async function recordAcknowledgement(tx: Transaction, usuarioId: string, origem: 'convite' | 'acesso', config: LegalConfig) {
  if (!config.exigido) return;
  for (const doc of config.documentos) await repository.record(tx, { usuarioId, tipo: doc.tipo, versao: doc.versao, hashDocumento: doc.hash, origem, snapshot: JSON.parse(JSON.stringify({ documento: doc, controlador: config.controlador, contato: config.contato, demonstracao: config.demonstracao, manifestacao: doc.tipo === 'termos' ? 'aceite_termos' : 'ciencia_aviso' })) as Prisma.InputJsonValue });
}
export async function pending(usuarioId: string) {
  const config = legalConfig(); if (!config.exigido) return false;
  const receipts = await repository.receipts(usuarioId);
  return config.documentos.some((doc) => !receipts.some((item) => item.tipo === doc.tipo && item.hashDocumento === doc.hash));
}
export async function acknowledge(usuarioId: string, input: Acknowledgement) {
  const config = validateAcknowledgement(input);
  if (!config.exigido) throw new HttpError(409, 'Documentos ainda em revisão; não há aceite institucional disponível.');
  await transaction((tx) => recordAcknowledgement(tx, usuarioId, 'acesso', config));
}
export async function ownReceipts(usuarioId: string) { return (await repository.receipts(usuarioId)).map(({ id, tipo, versao, hashDocumento, registradoEm, snapshot }) => ({ id, tipo, versao, hashDocumento, registradoEm, snapshot })); }
