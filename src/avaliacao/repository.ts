import type { Transaction } from '../lib/transaction.js';
import type { Actor } from '../auth/user-select.js';
import type { Prisma } from '../generated/prisma/client.js';
import { sheetScope } from '../registros/access.js';

export const sheet = (tx: Transaction, actor: Actor, id: string) => tx.fichaEstagio.findFirst({ where: { ...sheetScope(actor), id }, include: {
  vinculo: { include: { estagio: { include: { disciplina: true, turma: true, campoEstagio: true } }, matricula: { include: { aluno: { select: { nome: true, id: true } } } } } },
} });
export const list = (tx: Transaction, fichaId: string, pagina: number) => tx.avaliacaoEstagio.findMany({ where: { fichaId }, orderBy: { versao: 'desc' }, take: 20, skip: (pagina - 1) * 20 });
export const latest = (tx: Transaction, fichaId: string) => tx.avaliacaoEstagio.findFirst({ where: { fichaId }, orderBy: { versao: 'desc' } });
export const insert = (tx: Transaction, data: Prisma.AvaliacaoEstagioUncheckedCreateInput) => tx.avaliacaoEstagio.create({ data });
export const monitoring = (tx: Transaction, actor: Actor, pagina: number) => tx.vinculoEstagio.findMany({ where: { instituicaoId: actor.instituicaoId },
  select: { id: true, encerradoEm: true, alunoId: true, matricula: { select: { aluno: { select: { id: true, nome: true } } } },
    estagio: { select: { disciplina: { select: { nome: true, cargaHorariaTotal: true } }, professora: { select: { nome: true } }, turma: { select: { codigo: true } } } },
    ficha: { select: { id: true, fechamento: { select: { id: true } }, avaliacoes: { orderBy: { versao: 'desc' }, take: 1 },
      registros: { select: { status: true, versao: true, duracaoMinutos: true, aprovacoes: { where: { reabertura: null }, select: { versao: true } } } } } },
  }, orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
