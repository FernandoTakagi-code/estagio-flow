import { prisma } from '../lib/prisma.js';
import type { Actor } from '../auth/user-select.js';
import { stageScope } from './access.js';
import { stageSelect } from './repository.js';

const page = (pagina: number) => ({ take: 50, skip: (pagina - 1) * 50 });
export const listEnrollments = (instituicaoId: string, pagina: number) => prisma.matriculaTurma.findMany({ where: { instituicaoId, encerradoEm: null }, select: { id: true, alunoId: true, turmaId: true, iniciadoEm: true, turma: { select: { id: true, codigo: true } } }, orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], ...page(pagina) });
export const listStudentLinks = (actor: Actor, pagina: number) => prisma.vinculoEstagio.findMany({ where: { instituicaoId: actor.instituicaoId, alunoId: actor.id }, select: { id: true, iniciadoEm: true, encerradoEm: true, estagio: { select: stageSelect } }, orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], ...page(pagina) });
export const createClass = (instituicaoId: string, codigo: string) => prisma.turma.create({ data: { instituicaoId, codigo } });
export const createDiscipline = (instituicaoId: string, data: { codigo: string; nome: string; cargaHorariaTotal: number }) => prisma.disciplina.create({ data: { ...data, instituicaoId } });
export const createField = (instituicaoId: string, nome: string) => prisma.campoEstagio.create({ data: { instituicaoId, nome } });
export const listClasses = (instituicaoId: string, pagina: number) => prisma.turma.findMany({ where: { instituicaoId }, include: { _count: { select: { matriculas: { where: { encerradoEm: null } } } } }, orderBy: [{ codigo: 'asc' }, { id: 'asc' }], ...page(pagina) });
export const listDisciplines = (instituicaoId: string, pagina: number) => prisma.disciplina.findMany({ where: { instituicaoId }, orderBy: [{ codigo: 'asc' }, { id: 'asc' }], ...page(pagina) });
export const listFields = (instituicaoId: string, pagina: number) => prisma.campoEstagio.findMany({ where: { instituicaoId }, orderBy: [{ nome: 'asc' }, { id: 'asc' }], ...page(pagina) });
export const findStudent = (instituicaoId: string, id: string) => prisma.usuario.findFirst({ where: { id, instituicaoId, perfil: 'aluno' }, select: { id: true } });
export const studentEnrollments = (instituicaoId: string, alunoId: string, pagina: number) => prisma.matriculaTurma.findMany({ where: { alunoId, instituicaoId }, include: { turma: { select: { id: true, codigo: true } } }, orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], ...page(pagina) });
export const listGroups = (actor: Actor, pagina: number) => prisma.estagio.findMany({ where: stageScope(actor), select: stageSelect, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], ...page(pagina) });
export const findGroup = (actor: Actor, id: string) => prisma.estagio.findFirst({ where: { ...stageScope(actor), id }, select: stageSelect });
export const listMembers = (actor: Actor, id: string, pagina: number) => prisma.vinculoEstagio.findMany({ where: { estagioId: id, instituicaoId: actor.instituicaoId, ...(actor.perfil === 'aluno' ? { alunoId: actor.id } : {}) }, select: { id: true, iniciadoEm: true, encerradoEm: true, matricula: { select: { aluno: { select: { id: true, nome: true, ativo: true } } } } }, orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], ...page(pagina) });
export const eligibleStudents = (instituicaoId: string, group: { id: string; turma: { id: string } }, pagina: number, busca: string) => prisma.usuario.findMany({
  where: { instituicaoId, perfil: 'aluno', ativo: true, nome: { contains: busca, mode: 'insensitive' }, matriculas: { some: { turmaId: group.turma.id, encerradoEm: null } }, NOT: { matriculas: { some: { vinculos: { some: { estagioId: group.id, encerradoEm: null } } } } } },
  select: { id: true, nome: true }, orderBy: [{ nome: 'asc' }, { id: 'asc' }], ...page(pagina),
});
