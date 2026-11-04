import { z } from 'zod';
export function localCapture() {
  try { return process.env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname); } catch { return false; }
}
export function emailConfig() {
  const mode = z.enum(['disabled', 'capture', 'resend']).parse(process.env.EMAIL_MODE ?? 'disabled');
  if (mode === 'disabled') return { mode } as const;
  if (mode === 'capture' && !localCapture()) throw new Error('Captura de e-mails exige banco local descartável e ambiente não produtivo.');
  const base = new URL(process.env.PUBLIC_APP_URL ?? 'http://127.0.0.1:5173');
  if ((mode === 'resend' && base.protocol !== 'https:') || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('PUBLIC_APP_URL deve ser a origem HTTPS pública da aplicação.');
  const key = process.env.EMAIL_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('EMAIL_ENCRYPTION_KEY deve conter 32 bytes aleatórios em hexadecimal.');
  if (mode === 'resend' && (!process.env.RESEND_API_KEY || !z.email().safeParse(process.env.EMAIL_FROM).success)) throw new Error('Configure RESEND_API_KEY e EMAIL_FROM com domínio verificado.');
  return { mode, base: base.origin, key: Buffer.from(key, 'hex'), apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM } as const;
}
