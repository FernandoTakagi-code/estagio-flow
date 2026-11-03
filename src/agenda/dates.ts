import type { AgendaSessao } from '../generated/prisma/client.js';
export const localDay = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(value);
export const isoDay = (value: Date) => value.toISOString().slice(0, 10);
export function eligible(link: { id: string; iniciadoEm: Date; encerradoEm: Date | null }, session: AgendaSessao) {
  const date = isoDay(session.data);
  return date >= localDay(link.iniciadoEm) && (!link.encerradoEm || date <= localDay(link.encerradoEm));
}
