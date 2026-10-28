import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function hours(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h ? `${h}h ` : ''}${m}min` : `${h}h`;
}
export const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).replace('.', '');
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const statusLabels = { rascunho: 'Rascunho', enviado: 'Enviado', devolvido: 'Devolvido', aprovado: 'Aprovado', cancelado: 'Cancelado' };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
