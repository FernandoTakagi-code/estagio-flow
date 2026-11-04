import type { User } from '../lib/types';

export interface Person extends User { ativo: boolean; convitePendente: boolean; matriculaAtiva?: { id: string; turmaId: string; turma: SchoolClass } | null }
export interface SchoolClass { id: string; codigo: string; alunosMatriculados?: number }
export interface Discipline { id: string; codigo: string; nome: string; cargaHorariaTotal: number }
export interface Field { id: string; nome: string }
export interface Enrollment { id: string; alunoId: string; turmaId: string; iniciadoEm: string; encerradoEm?: string | null; turma: SchoolClass }
export interface Group { id: string; codigo: string; encerradoEm: string | null; turma: SchoolClass; disciplina: Discipline; campoEstagio: Field; professora: Person }
export interface Member { id: string; iniciadoEm: string; encerradoEm: string | null; matricula: { aluno: { id: string; nome: string; ativo: boolean } } }
export interface Invite { token: string; expiraEm: string; email?: { estado: 'na_fila' | 'manual' } }
export interface Invitation { nome: string; email: string; convite: Invite }
export interface Registry { classes: SchoolClass[]; disciplines: Discipline[]; fields: Field[]; groups: Group[] }
