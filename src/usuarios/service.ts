import type { Actor } from '../auth/user-select.js';
import { HttpError } from '../lib/errors.js';
import * as repository from './repository.js';

type PersonRow = NonNullable<Awaited<ReturnType<typeof repository.findPerson>>>;
function presentPerson({ senhaHash, matriculas, ...person }: PersonRow) {
  return { ...person, convitePendente: senhaHash === null, matriculaAtiva: matriculas[0] ?? null };
}
export async function listUsers(actor: Actor, query: Parameters<typeof repository.searchUsers>[1]) {
  const result = await repository.searchUsers(actor.instituicaoId, query);
  return { usuarios: result.usuarios.map(presentPerson), total: result.total, pagina: query.pagina, porPagina: 50 };
}
export async function findPerson(actor: Actor, id: string) {
  const person = await repository.findPerson(actor.instituicaoId, id);
  if (!person) throw new HttpError(404, 'Usuário não encontrado.');
  return presentPerson(person);
}
