import type { z } from 'zod';
import type { Actor } from '../auth/service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { approveBatchSchema } from './schemas.js';
import { lockContext, presentRecord, recordEvent, recordScope } from './service.js';

function requireTeacher(actor: Actor) {
  if (actor.perfil !== 'professora') throw new HttpError(403, 'Somente a professora responsável pode executar esta ação.');
}

export async function approveRecords(actor: Actor, input: z.infer<typeof approveBatchSchema>) {
  requireTeacher(actor);
  return prisma.$transaction(async (tx) => {
    const refs = await tx.registroEstagio.findMany({
      where: { AND: [recordScope(actor), { id: { in: input.registros.map((item) => item.id) } }] },
      include: { ficha: true },
    });
    if (refs.length !== input.registros.length) throw new HttpError(404, 'Um ou mais registros não foram encontrados.');
    const first = refs[0]!;
    if (refs.some((ref) => ref.fichaId !== first.fichaId)) throw new HttpError(400, 'O lote deve conter registros de uma única ficha.');
    await lockContext(tx, actor, first.ficha.vinculoId);
    // Read again after locking: another request may have changed a version while this one waited.
    const current = await tx.registroEstagio.findMany({ where: { id: { in: refs.map((ref) => ref.id) } }, orderBy: { id: 'asc' } });
    for (const record of current) {
      const expected = input.registros.find((item) => item.id === record.id)!;
      if (record.status !== 'enviado' || record.versao !== expected.versao) {
        throw new HttpError(409, 'O lote contém registro alterado ou que não está enviado. Atualize a consulta.');
      }
    }
    const sheet = await tx.fichaEstagio.findUniqueOrThrow({ where: { id: first.fichaId }, select: {
      id: true,
      vinculo: { select: {
        id: true, iniciadoEm: true, encerradoEm: true,
        matricula: { select: { aluno: { select: { id: true, nome: true } } } },
        estagio: { select: {
          id: true, codigo: true, turma: { select: { id: true, codigo: true } },
          disciplina: { select: { id: true, codigo: true, nome: true, cargaHorariaTotal: true } },
          campoEstagio: { select: { id: true, nome: true } },
        } },
      } },
    } });
    const result = [];
    for (const record of current) {
      const approved = await tx.registroEstagio.update({ where: { id: record.id }, data: { status: 'aprovado', versao: { increment: 1 } } });
      const approval = await tx.aprovacaoRegistro.create({ data: {
        instituicaoId: actor.instituicaoId, registroId: approved.id, professoraId: actor.id, versao: approved.versao,
        snapshot: JSON.parse(JSON.stringify({
          registro: presentRecord(approved), ficha: sheet,
          professora: { id: actor.id, nome: actor.nome, coren: actor.coren },
        })) as Prisma.InputJsonValue,
      } });
      await recordEvent(tx, actor, approved, 'aprovado');
      result.push({ registro: presentRecord(approved), aprovacao: approval });
    }
    return { aprovacoes: result };
  });
}

export async function reopenRecord(actor: Actor, id: string, versao: number, motivo: string) {
  requireTeacher(actor);
  return prisma.$transaction(async (tx) => {
    const ref = await tx.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, include: { ficha: true } });
    if (!ref) throw new HttpError(404, 'Registro não encontrado.');
    await lockContext(tx, actor, ref.ficha.vinculoId);
    const current = await tx.registroEstagio.findUniqueOrThrow({ where: { id } });
    if (current.status !== 'aprovado' || current.versao !== versao) throw new HttpError(409, 'Registro alterado ou sem aprovação vigente. Atualize a consulta.');
    const approval = await tx.aprovacaoRegistro.findFirst({ where: { registroId: id, versao, instituicaoId: actor.instituicaoId, reabertura: null } });
    if (!approval) throw new HttpError(409, 'Aprovação vigente não encontrada.');
    const reabertura = await tx.reaberturaAprovacao.create({ data: {
      instituicaoId: actor.instituicaoId, aprovacaoId: approval.id, professoraId: actor.id, motivo,
    } });
    const record = await tx.registroEstagio.update({ where: { id }, data: { status: 'devolvido', versao: { increment: 1 } } });
    await recordEvent(tx, actor, record, 'reaberto', motivo);
    return { registro: presentRecord(record), reabertura };
  });
}

export async function listApprovals(actor: Actor, id: string, pagina: number) {
  // Keep the record and its approval flags in one consistent database snapshot.
  return prisma.$transaction(async (tx) => {
    const record = await tx.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, select: { status: true, versao: true } });
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    const approvals = await tx.aprovacaoRegistro.findMany({
      where: { registroId: id, instituicaoId: actor.instituicaoId }, include: { reabertura: true },
      orderBy: { versao: 'desc' }, take: 50, skip: (pagina - 1) * 50,
    });
    return { aprovacoes: approvals.map((approval) => ({ ...approval, vigente: record.status === 'aprovado' && record.versao === approval.versao && !approval.reabertura })), pagina, porPagina: 50 };
  }, { isolationLevel: 'RepeatableRead' });
}

type HourRow = {
  disciplinaId: string; codigo: string; nome: string; cargaHorariaMinutos: number;
  minutosAprovados: number; minutosEnviados: number;
};

export async function studentHours(actor: Actor, alunoId: string, pagina: number) {
  if (actor.perfil === 'aluno' && actor.id !== alunoId) throw new HttpError(404, 'Aluno não encontrado.');
  return prisma.$transaction(async (tx) => {
    const student = await tx.usuario.findFirst({ where: {
      id: alunoId, instituicaoId: actor.instituicaoId, perfil: 'aluno',
      ...(actor.perfil === 'professora' ? { matriculas: { some: { vinculos: { some: { estagio: { professoraId: actor.id } } } } } } : {}),
    }, select: { id: true, nome: true } });
    if (!student) throw new HttpError(404, 'Aluno não encontrado.');
    // Count only the current version's approval, with no reopening. Historical approvals never add hours twice.
    const disciplines = await tx.$queryRaw<HourRow[]>`
      SELECT d.id AS "disciplinaId", d.codigo, d.nome, d.carga_horaria_total * 60 AS "cargaHorariaMinutos",
        COALESCE(SUM(CASE WHEN r.status = 'aprovado' AND a.id IS NOT NULL AND re.id IS NULL
          THEN r.duracao_minutos ELSE 0 END), 0)::double precision AS "minutosAprovados",
        COALESCE(SUM(CASE WHEN r.status = 'enviado' THEN r.duracao_minutos ELSE 0 END), 0)::double precision AS "minutosEnviados"
      FROM vinculo_estagio v
      JOIN estagio e ON e.id = v.estagio_id AND e.instituicao_id = v.instituicao_id
      JOIN disciplina d ON d.id = v.disciplina_id AND d.instituicao_id = v.instituicao_id
      LEFT JOIN ficha_estagio f ON f.vinculo_id = v.id AND f.instituicao_id = v.instituicao_id
      LEFT JOIN registro_estagio r ON r.ficha_id = f.id AND r.instituicao_id = f.instituicao_id
      LEFT JOIN aprovacao_registro a ON a.registro_id = r.id AND a.instituicao_id = r.instituicao_id AND a.versao = r.versao
      LEFT JOIN reabertura_aprovacao re ON re.aprovacao_id = a.id AND re.instituicao_id = a.instituicao_id
      WHERE v.aluno_id = ${alunoId}::uuid AND v.instituicao_id = ${actor.instituicaoId}::uuid
        AND (${actor.perfil} <> 'professora' OR e.professora_id = ${actor.id}::uuid)
      GROUP BY d.id, d.codigo, d.nome, d.carga_horaria_total
      ORDER BY d.codigo, d.id LIMIT 50 OFFSET ${(pagina - 1) * 50}`;
    const partial = actor.perfil === 'professora';
    return {
      aluno: student, escopo: partial ? 'grupos_da_professora' : 'aluno_na_instituicao',
      disciplinas: disciplines.map((row) => ({ ...row,
        minutosRestantes: partial ? null : Math.max(0, row.cargaHorariaMinutos - row.minutosAprovados),
        minutosExcedentes: partial ? null : Math.max(0, row.minutosAprovados - row.cargaHorariaMinutos),
      })), pagina, porPagina: 50,
    };
  }, { isolationLevel: 'RepeatableRead' });
}
