import { z } from 'zod';
import { listSchema } from '../auth/schemas.js';
export const userQuerySchema = listSchema.extend({ busca: z.string().trim().max(100).default(''), perfil: z.enum(['aluno', 'professora', 'coordenacao']).optional(), cadastros: z.literal('1').optional(), ativo: z.enum(['true', 'false']).optional() });
