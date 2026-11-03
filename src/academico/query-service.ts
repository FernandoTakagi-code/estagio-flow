import { HttpError } from '../lib/errors.js';
import type { Actor } from '../auth/user-select.js';
import * as repository from './query-repository.js';

export const listEnrollments = repository.listEnrollments;
export const createClass = repository.createClass;
export const createDiscipline = repository.createDiscipline;
export const createField = repository.createField;
export const listDisciplines = repository.listDisciplines;
export const listFields = repository.listFields;
export const listGroups = repository.listGroups;
export async function listClasses(instituicaoId: string, pagina: number) {
  return (await repository.listClasses(instituicaoId, pagina)).map(({ _count, ...item }) => ({ ...item, alunosMatriculados: _count.matriculas }));
}
export function listStudentLinks(actor: Actor, pagina: number) {
  if (actor.perfil !== 'aluno') throw new HttpError(403, 'Consulta disponível somente para alunos.');
  return repository.listStudentLinks(actor, pagina);
}
export async function studentEnrollments(actor: Actor, id: string, pagina: number) {
  if (!await repository.findStudent(actor.instituicaoId, id)) throw new HttpError(404, 'Aluno não encontrado.');
  return repository.studentEnrollments(actor.instituicaoId, id, pagina);
}
export async function findGroup(actor: Actor, id: string) {
  const group = await repository.findGroup(actor, id);
  if (!group) throw new HttpError(404, 'Grupo de estágio não encontrado.');
  return group;
}
export async function listMembers(actor: Actor, id: string, pagina: number) {
  await findGroup(actor, id);
  return repository.listMembers(actor, id, pagina);
}
export async function eligibleStudents(actor: Actor, id: string, pagina: number, busca: string) {
  if (actor.perfil !== 'coordenacao') throw new HttpError(403, 'Acesso permitido somente à coordenação.');
  const group = await findGroup(actor, id);
  if (group.encerradoEm) throw new HttpError(409, 'Grupo de estágio encerrado.');
  return repository.eligibleStudents(actor.instituicaoId, group, pagina, busca);
}
