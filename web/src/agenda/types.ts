import type { Stage } from '../lib/types';
export interface Session { id: string; estagioId: string; data: string; horaInicio: string; horaFim: string; duracaoMinutos: number; versao: number; cancelada: boolean; estagio: Stage; }
export interface Attendee { vinculoId: string; alunoId: string; nome: string; frequencia: { id: string; versao: number; situacao: 'presente' | 'falta' | 'justificada'; motivo: string | null } | null; registro: { id: string; status: string; aprovado: boolean } | null }
export interface SessionDetail { sessao: Session; alunos: Attendee[] }
export interface SessionRecord { sessaoId: string; vinculoId: string; data: string; horaInicio: string; horaFim: string }
