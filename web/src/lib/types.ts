export type Role = 'aluno' | 'professora' | 'coordenacao';
export interface User { id: string; nome: string; email: string; perfil: Role; coren: string | null }
export type Status = 'rascunho' | 'enviado' | 'devolvido' | 'aprovado' | 'cancelado';
export interface RecordItem { id: string; alunoId: string; fichaId: string; data: string; horaInicio: string; horaFim: string; atividades: string; duracaoMinutos: number; status: Status; versao: number; motivoDevolucao?: string | null }
export interface Stage { id: string; codigo: string; encerradoEm: string | null; disciplina: { id: string; nome: string; cargaHorariaTotal: number }; campoEstagio: { nome: string }; turma: { codigo: string }; professora: { nome: string } }
export interface Link { id: string; iniciadoEm: string; encerradoEm: string | null; estagio: Stage }
export interface Sheet { id: string; alunoId: string; vinculoId: string; vinculo: { estagioId: string; encerradoEm: string | null; matricula: { aluno: { id: string; nome: string } }; estagio: { id: string; codigo: string; disciplina: { id: string; nome: string }; campoEstagio: { nome: string }; turma: { codigo: string } } } }
export interface Hours { disciplinaId: string; nome: string; cargaHorariaMinutos: number; minutosAprovados: number; minutosEnviados: number }
export interface Panel { registros: { status: Status; quantidade: number; minutos: number }[]; cargaHorariaMinutos: number | null }
export interface RecordEvent { id: string; acao: string; versao: number; motivo: string | null; criadoEm: string; snapshot: { data: string; atividades: string; horaInicio: string; horaFim: string; duracaoMinutos: number } }
export interface Approval { id: string; versao: number; vigente: boolean; criadoEm: string; snapshot: { professora: { nome: string; coren: string | null }; registro: { atividades: string; duracaoMinutos: number } }; reabertura: { motivo: string; criadoEm: string } | null }
