import { z } from 'zod';

const codigo = z.string().trim().min(1).max(50).toUpperCase();
const nome = z.string().trim().min(2).max(200);

export const turmaSchema = z.strictObject({ codigo });
export const disciplinaSchema = z.strictObject({ codigo, nome, cargaHorariaTotal: z.number().int().min(1).max(10000) });
export const campoSchema = z.strictObject({ nome });
export const matriculaSchema = z.strictObject({ turmaId: z.uuid() });
export const alunoSchema = z.strictObject({ alunoId: z.uuid() });
export const estagioSchema = z.strictObject({
  codigo, turmaId: z.uuid(), disciplinaId: z.uuid(), campoEstagioId: z.uuid(), professoraId: z.uuid(),
});
