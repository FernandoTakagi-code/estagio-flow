import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/user-select.js';

export function stageScope(actor: Actor): Prisma.EstagioWhereInput {
  if (actor.perfil === 'professora') return { instituicaoId: actor.instituicaoId, professoraId: actor.id };
  if (actor.perfil === 'aluno') return { instituicaoId: actor.instituicaoId, vinculos: { some: { alunoId: actor.id } } };
  return { instituicaoId: actor.instituicaoId };
}
