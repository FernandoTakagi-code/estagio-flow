import type { Prisma } from '../generated/prisma/client.js';

export const publicUserSelect = {
  id: true, instituicaoId: true, nome: true, email: true,
  perfil: true, coren: true, ativo: true, criadoEm: true,
} satisfies Prisma.UsuarioSelect;
export type Actor = Prisma.UsuarioGetPayload<{ select: typeof publicUserSelect }>;
