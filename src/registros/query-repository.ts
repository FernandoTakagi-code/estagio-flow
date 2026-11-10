import { prisma } from '../lib/prisma.js';
import type { Transaction } from '../lib/transaction.js';
import type { Actor } from '../auth/user-select.js';
import type { Prisma } from '../generated/prisma/client.js';
import { recordScope, sheetScope } from './access.js';

export const listSheets = (actor: Actor, pagina: number) => prisma.fichaEstagio.findMany({ where: sheetScope(actor),
  include: { fechamento: { select: { id: true, criadoEm: true, totalMinutos: true, dataUltimoDia: true, coren: true } }, vinculo: { select: { estagioId: true, iniciadoEm: true, encerradoEm: true,
    matricula: { select: { aluno: { select: { id: true, nome: true } } } },
    estagio: { select: { id: true, codigo: true, disciplina: { select: { id: true, nome: true } }, campoEstagio: { select: { nome: true } }, turma: { select: { codigo: true } } } },
  } } }, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
export const listRecords = (actor: Actor, pagina: number, filters: { fichaId?: string; status?: Prisma.RegistroEstagioWhereInput['status'] }) => prisma.registroEstagio.findMany({
  where: { AND: [recordScope(actor), filters] },
  include: { ficha: { select: { fechamento: { select: { id: true } } } }, eventos: { where: { acao: { in: ['devolvido', 'reaberto'] } }, select: { motivo: true }, orderBy: { versao: 'desc' }, take: 1 } },
  orderBy: [{ data: 'desc' }, { inicioMinuto: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50,
});
export const findRecord = (actor: Actor, id: string) => prisma.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, include: { ficha: { select: { fechamento: { select: { id: true } } } } } });
export const history = (instituicaoId: string, registroId: string, pagina: number) => prisma.eventoRegistro.findMany({ where: { registroId, instituicaoId }, orderBy: { versao: 'desc' }, take: 50, skip: (pagina - 1) * 50 });

export const panelGroups = (tx: Transaction, actor: Actor) => tx.$queryRaw<{ status: string; quantidade: number; minutos: number }[]>`
        SELECT r.status, COUNT(*)::double precision AS quantidade,
          SUM(r.duracao_minutos)::double precision AS minutos
        FROM registro_estagio r
        JOIN ficha_estagio f ON f.id = r.ficha_id AND f.instituicao_id = r.instituicao_id
        JOIN vinculo_estagio v ON v.id = f.vinculo_id AND v.instituicao_id = f.instituicao_id
        JOIN estagio e ON e.id = v.estagio_id AND e.instituicao_id = v.instituicao_id
        LEFT JOIN aprovacao_registro a ON a.registro_id = r.id AND a.instituicao_id = r.instituicao_id AND a.versao = r.versao
        LEFT JOIN reabertura_aprovacao re ON re.aprovacao_id = a.id AND re.instituicao_id = a.instituicao_id
        WHERE r.instituicao_id = ${actor.instituicaoId}::uuid
          AND (${actor.perfil} <> 'aluno' OR r.aluno_id = ${actor.id}::uuid)
          AND (${actor.perfil} <> 'professora' OR (e.professora_id = ${actor.id}::uuid AND r.status IN ('enviado', 'devolvido', 'aprovado')))
          AND (r.status <> 'aprovado' OR (a.id IS NOT NULL AND re.id IS NULL))
        GROUP BY r.status`;
