import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(12).max(128);

export const loginSchema = z.strictObject({
  email: emailSchema,
  senha: z.string().min(1).max(128),
});

export const acceptInviteSchema = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  senha: passwordSchema,
});

export const createUserSchema = z.strictObject({
  nome: z.string().trim().min(2).max(200),
  email: emailSchema,
  perfil: z.enum(['aluno', 'professora']),
  coren: z.string().trim().min(1).max(30).optional(),
}).refine((data) => data.perfil === 'professora' || data.coren === undefined, {
  path: ['coren'], message: 'COREN é permitido somente para professora.',
});

export const userIdSchema = z.uuid();
export const activeSchema = z.strictObject({ ativo: z.boolean() });
export const listSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
});

export const adminSchema = z.strictObject({
  nome: z.string().trim().min(2).max(200),
  email: emailSchema,
  instituicaoId: z.uuid(),
  senha: passwordSchema,
});
