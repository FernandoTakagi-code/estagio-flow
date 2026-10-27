import { z } from 'zod';

const date = z.iso.date().refine((value) => value >= '2000-01-01' && value <= '2100-12-31', 'Data fora do intervalo permitido.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.');
export const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const fields = { data: date, horaInicio: time, horaFim: time, atividades: z.string().trim().min(1).max(4000) };
const ordered = (value: { horaInicio: string; horaFim: string }) => minutes(value.horaFim) > minutes(value.horaInicio);
export const createRecordSchema = z.strictObject({ vinculoId: z.uuid(), ...fields }).refine(ordered, { message: 'A saída deve ser depois da entrada, no mesmo dia.', path: ['horaFim'] });
export const editRecordSchema = z.strictObject({ versao: z.number().int().positive(), ...fields }).refine(ordered, { message: 'A saída deve ser depois da entrada, no mesmo dia.', path: ['horaFim'] });
export const versionSchema = z.strictObject({ versao: z.number().int().positive() });
export const returnRecordSchema = versionSchema.extend({ motivo: z.string().trim().min(1).max(1000) });
export const recordQuerySchema = z.strictObject({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  fichaId: z.uuid().optional(),
  status: z.enum(['rascunho', 'enviado', 'devolvido', 'cancelado']).optional(),
});
