import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../auth/user-select.js';
export function sheetScope(actor: Actor): Prisma.FichaEstagioWhereInput {
  return { instituicaoId: actor.instituicaoId, ...(actor.perfil === 'aluno' ? { alunoId: actor.id } : {}), ...(actor.perfil === 'professora' ? { vinculo: { estagio: { professoraId: actor.id } } } : {}) };
}
export function recordScope(actor: Actor): Prisma.RegistroEstagioWhereInput {
  return { instituicaoId: actor.instituicaoId, ficha: sheetScope(actor), ...(actor.perfil === 'professora' ? { status: { in: ['enviado', 'devolvido', 'aprovado'] } } : {}) };
}
