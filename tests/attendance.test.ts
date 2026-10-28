import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { startTestDatabase } from './helpers/database.js';
import { createTokenService } from '../src/auth/token.js';

let context: Awaited<ReturnType<typeof startTestDatabase>>;
let app: Express;
let institutionId: string;
let studentId: string;
let linkId: string;
let stageId: string;
let studentToken: string;
let otherStudentToken: string;
let teacherToken: string;
let otherTeacherToken: string;
let coordinatorToken: string;
const day = '2026-01-15';
const body = (overrides: Record<string, unknown> = {}) => ({ vinculoId: linkId, data: day, horaInicio: '08:00', horaFim: '12:30', atividades: 'Atividades fictícias de aprendizagem.', ...overrides });
const post = (path: string, data: object, bearer = studentToken) => request(app).post('/frequencia' + path).auth(bearer, { type: 'bearer' }).send(data);
const get = (path: string, bearer = studentToken) => request(app).get('/frequencia' + path).auth(bearer, { type: 'bearer' });
async function create(overrides: Record<string, unknown> = {}) {
  const response = await post('/registros', body(overrides));
  expect(response.status).toBe(201);
  return response.body.registro as { id: string; fichaId: string; versao: number; status: string; duracaoMinutos: number };
}
const edit = (id: string, versao = 1, overrides: Record<string, unknown> = {}) => {
  const { vinculoId: _, ...data } = body(overrides);
  return request(app).put(`/frequencia/registros/${id}`).auth(studentToken, { type: 'bearer' }).send({ ...data, versao });
};

beforeAll(async () => { context = await startTestDatabase(); });
beforeEach(async () => {
  if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Banco de teste precisa ser local.');
  const db = context.prisma;
  await db.$executeRawUnsafe('TRUNCATE instituicao, usuario, turma CASCADE');
  institutionId = (await db.instituicao.create({ data: { nome: 'Escola Fictícia' } })).id;
  const coordinator = await context.createCoordinator({ nome: 'Coordenação Fictícia', email: 'coord@example.test', instituicaoId: institutionId, senha: 'SenhaFicticiaParaTeste2026!' });
  const saved = await db.usuario.findUniqueOrThrow({ where: { id: coordinator.id } });
  const base = { instituicaoId: institutionId, nome: 'Pessoa Fictícia', senhaHash: saved.senhaHash };
  const student = await db.usuario.create({ data: { ...base, perfil: 'aluno', email: 'aluno@example.test' } });
  studentId = student.id;
  const otherStudent = await db.usuario.create({ data: { ...base, perfil: 'aluno', email: 'outro@example.test' } });
  const teacher = await db.usuario.create({ data: { ...base, perfil: 'professora', email: 'prof@example.test' } });
  const otherTeacher = await db.usuario.create({ data: { ...base, perfil: 'professora', email: 'prof2@example.test' } });
  const tokens = createTokenService(process.env.JWT_SECRET);
  studentToken = await tokens.issue(student.id, 0);
  otherStudentToken = await tokens.issue(otherStudent.id, 0);
  teacherToken = await tokens.issue(teacher.id, 0);
  otherTeacherToken = await tokens.issue(otherTeacher.id, 0);
  coordinatorToken = await tokens.issue(coordinator.id, 0);
  const turma = await db.turma.create({ data: { instituicaoId: institutionId, codigo: 'TESTE' } });
  const disciplina = await db.disciplina.create({ data: { instituicaoId: institutionId, codigo: 'TESTE', nome: 'Disciplina Fictícia', cargaHorariaTotal: 90 } });
  const campo = await db.campoEstagio.create({ data: { instituicaoId: institutionId, nome: 'Hospital Fictício' } });
  const stage = await db.estagio.create({ data: { instituicaoId: institutionId, codigo: 'TESTE', turmaId: turma.id, disciplinaId: disciplina.id, campoEstagioId: campo.id, professoraId: teacher.id, criadoPorId: coordinator.id } });
  stageId = stage.id;
  const enrollment = await db.matriculaTurma.create({ data: { instituicaoId: institutionId, turmaId: turma.id, alunoId: student.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } });
  linkId = (await db.vinculoEstagio.create({ data: { instituicaoId: institutionId, estagioId: stage.id, turmaId: turma.id, disciplinaId: disciplina.id, matriculaId: enrollment.id, alunoId: student.id, criadoPorId: coordinator.id, iniciadoEm: new Date('2020-01-01T12:00:00Z') } })).id;
  app = context.createApp();
});
afterAll(async () => {
  await context?.prisma.$disconnect();
  await context?.socket.stop();
  await context?.database.close();
});

describe('registros de frequência', () => {
  it('cria ficha automaticamente e calcula duração sem confiar em totais do cliente', async () => {
    const record = await create();
    expect(record.duracaoMinutos).toBe(270);
    expect(record.status).toBe('rascunho');
    await create({ horaInicio: '13:00', horaFim: '15:00' });
    expect(await context.prisma.fichaEstagio.count()).toBe(1);
    expect((await post('/registros', body({ duracaoMinutos: 999 }))).status).toBe(400);
    expect((await get('/fichas')).body.fichas).toHaveLength(1);
  });

  it('exige autenticação e só permite ao aluno criar para seu vínculo', async () => {
    expect((await request(app).get('/frequencia/registros')).status).toBe(401);
    for (const bearer of [coordinatorToken, teacherToken]) expect((await post('/registros', body(), bearer)).status).toBe(403);
    expect((await post('/registros', body(), otherStudentToken)).status).toBe(404);
  });

  it('valida datas reais, horários, atividades e campos desconhecidos', async () => {
    for (const invalid of [{ data: '2026-02-30' }, { data: '15/01/2026' }, { horaInicio: '8:00' }, { horaFim: '24:00' }, { horaFim: '07:59' }, { horaFim: '08:00' }, { atividades: '  ' }, { atividades: 'a'.repeat(4001) }, { alunoId: studentId }]) {
      expect((await post('/registros', body(invalid))).status).toBe(400);
    }
    expect((await post('/registros', body({ data: '2099-01-01' }))).status).toBe(409);
    expect((await post('/registros', body({ data: '2019-12-31' }))).status).toBe(409);
  });

  it('permite horários contíguos mas impede duplicidade e sobreposição', async () => {
    await create();
    expect((await post('/registros', body())).status).toBe(409);
    expect((await post('/registros', body({ horaInicio: '12:00', horaFim: '13:00' }))).status).toBe(409);
    await create({ horaInicio: '12:30', horaFim: '13:00' });
    await create({ data: '2026-01-16' });
  });

  it('serializa criações concorrentes do mesmo aluno', async () => {
    const responses = await Promise.all([post('/registros', body()), post('/registros', body())]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await context.prisma.eventoRegistro.count()).toBe(1);
  });

  it('bloqueia sobreposição entre disciplinas diferentes', async () => {
    await create();
    const db = context.prisma;
    const stage = await db.estagio.findUniqueOrThrow({ where: { id: stageId } });
    const link = await db.vinculoEstagio.findUniqueOrThrow({ where: { id: linkId } });
    const discipline = await db.disciplina.create({ data: { instituicaoId: institutionId, codigo: 'OUTRA', nome: 'Outra Disciplina', cargaHorariaTotal: 30 } });
    const nextStage = await db.estagio.create({ data: { ...stage, id: undefined, codigo: 'OUTRO', disciplinaId: discipline.id } });
    const nextLink = await db.vinculoEstagio.create({ data: { ...link, id: undefined, estagioId: nextStage.id, disciplinaId: discipline.id } });
    expect((await post('/registros', body({ vinculoId: nextLink.id }))).status).toBe(409);
    expect(await db.fichaEstagio.count()).toBe(1);
  });

  it('edita rascunho e rejeita versão desatualizada e sobreposição na edição', async () => {
    const record = await create();
    await create({ horaInicio: '13:00', horaFim: '14:00' });
    expect((await edit(record.id, 1, { horaFim: '13:30' })).status).toBe(409);
    const updated = await edit(record.id, 1, { horaFim: '12:00' });
    expect(updated.status).toBe(200);
    expect(updated.body.registro.duracaoMinutos).toBe(240);
    expect(updated.body.registro.versao).toBe(2);
    expect((await edit(record.id)).status).toBe(409);
  });

  it('preserva todas as revisões no ciclo enviar, devolver, corrigir e reenviar', async () => {
    const record = await create();
    expect((await get(`/registros/${record.id}`, teacherToken)).status).toBe(404);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 1 })).status).toBe(200);
    expect((await edit(record.id, 2)).status).toBe(409);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 2 })).status).toBe(409);
    expect((await post(`/registros/${record.id}/devolver`, { versao: 2, motivo: 'Detalhar as atividades.' }, teacherToken)).status).toBe(200);
    expect((await edit(record.id, 3, { atividades: 'Descrição fictícia corrigida.' })).status).toBe(200);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 4 })).status).toBe(200);
    const history = await get(`/registros/${record.id}/historico`);
    expect(history.body.historico.map((e: { acao: string }) => e.acao)).toEqual(['enviado', 'editado', 'devolvido', 'enviado', 'criado']);
    expect(history.body.historico[2].motivo).toBe('Detalhar as atividades.');
    expect(history.body.historico[4].snapshot.atividades).toBe(body().atividades);
  });

  it('exige motivo para devolver e impede devolução por outros perfis ou professoras', async () => {
    const record = await create();
    await post(`/registros/${record.id}/enviar`, { versao: 1 });
    expect((await post(`/registros/${record.id}/devolver`, { versao: 2, motivo: ' ' }, teacherToken)).status).toBe(400);
    for (const bearer of [studentToken, coordinatorToken]) expect((await post(`/registros/${record.id}/devolver`, { versao: 2, motivo: 'Corrigir.' }, bearer)).status).toBe(403);
    expect((await post(`/registros/${record.id}/devolver`, { versao: 2, motivo: 'Corrigir.' }, otherTeacherToken)).status).toBe(404);
  });

  it('envios simultâneos produzem uma única transição e evento', async () => {
    const record = await create();
    const results = await Promise.all([post(`/registros/${record.id}/enviar`, { versao: 1 }), post(`/registros/${record.id}/enviar`, { versao: 1 })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await context.prisma.eventoRegistro.count()).toBe(2);
  });

  it('isola registros, fichas e histórico de outros alunos e instituições', async () => {
    const record = await create();
    const db = context.prisma;
    const institution = await db.instituicao.create({ data: { nome: 'Outra Escola Fictícia' } });
    const coordinator = await context.createCoordinator({ nome: 'Outra Coordenação', email: 'outracoord@example.test', instituicaoId: institution.id, senha: 'SenhaFicticiaParaTeste2026!' });
    const foreignToken = await createTokenService(process.env.JWT_SECRET).issue(coordinator.id, 0);
    for (const bearer of [otherStudentToken, otherTeacherToken, foreignToken]) {
      expect((await get('/registros', bearer)).body.registros).toHaveLength(0);
      expect((await get('/fichas', bearer)).body.fichas).toHaveLength(0);
      expect((await get(`/registros/${record.id}`, bearer)).status).toBe(404);
      expect((await get(`/registros/${record.id}/historico`, bearer)).status).toBe(404);
    }
  });

  it('professora não lista rascunhos nem contorna o filtro de status', async () => {
    await create();
    expect((await get('/registros?status=rascunho', teacherToken)).body.registros).toHaveLength(0);
    expect((await get('/registros', coordinatorToken)).body.registros).toHaveLength(1);
  });

  it('cancela rascunho sem apagar histórico e libera o horário', async () => {
    const record = await create();
    expect((await post(`/registros/${record.id}/cancelar`, { versao: 1 })).status).toBe(200);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 2 })).status).toBe(409);
    expect((await edit(record.id, 2)).status).toBe(409);
    await create();
    expect(await context.prisma.eventoRegistro.count()).toBe(3);
  });

  it('não permite cancelar um registro enviado', async () => {
    const record = await create();
    await post(`/registros/${record.id}/enviar`, { versao: 1 });
    expect((await post(`/registros/${record.id}/cancelar`, { versao: 2 })).status).toBe(409);
  });

  it('após encerrar vínculo permite corrigir registros anteriores mas não criar novos', async () => {
    const record = await create();
    await context.prisma.vinculoEstagio.update({ where: { id: linkId }, data: { encerradoEm: new Date('2026-01-16T12:00:00Z') } });
    expect((await post('/registros', body({ data: '2026-01-16' }))).status).toBe(409);
    expect((await edit(record.id, 1, { data: '2026-01-17' })).status).toBe(409);
    expect((await edit(record.id)).status).toBe(200);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 2 })).status).toBe(200);
    expect((await post(`/registros/${record.id}/devolver`, { versao: 3, motivo: 'Corrigir.' }, teacherToken)).status).toBe(200);
  });

  it('considera a data do vínculo no fuso de São Paulo', async () => {
    await context.prisma.vinculoEstagio.update({ where: { id: linkId }, data: { iniciadoEm: new Date('2026-01-16T01:00:00Z') } });
    await create(); // 01:00 UTC ainda é dia 15 em São Paulo.
  });

  it('banco rejeita durações inválidas, histórico alterado e fichas cruzadas', async () => {
    const record = await create();
    const db = context.prisma;
    await expect(db.registroEstagio.update({ where: { id: record.id }, data: { duracaoMinutos: 1 } })).rejects.toThrow();
    await expect(db.eventoRegistro.updateMany({ where: { registroId: record.id }, data: { motivo: 'Apagar informação anterior' } })).rejects.toThrow();
    await expect(db.eventoRegistro.deleteMany({ where: { registroId: record.id } })).rejects.toThrow();
    const other = await db.usuario.findUniqueOrThrow({ where: { email: 'outro@example.test' } });
    await expect(db.registroEstagio.update({ where: { id: record.id }, data: { alunoId: other.id } })).rejects.toThrow();
    const tables = await db.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('ficha_estagio', 'registro_estagio', 'evento_registro')`;
    expect(tables).toHaveLength(3);
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
  });

  it('pagina listagens e valida filtros', async () => {
    const record = await create();
    expect((await get(`/registros?fichaId=${record.fichaId}&status=rascunho`)).body.registros).toHaveLength(1);
    expect((await get('/registros?pagina=2')).body.registros).toHaveLength(0);
    expect((await get('/registros?status=inexistente')).status).toBe(400);
    expect((await get('/registros?pagina=0')).status).toBe(400);
    expect((await get('/registros?alunoId=' + studentId)).status).toBe(400);
  });
});

async function submitted(overrides: Record<string, unknown> = {}) {
  const record = await create(overrides);
  const response = await post(`/registros/${record.id}/enviar`, { versao: record.versao });
  expect(response.status).toBe(200);
  return response.body.registro as typeof record;
}
const approve = (records: { id: string; versao: number }[], bearer = teacherToken) => post('/registros/aprovar', { registros: records.map(({ id, versao }) => ({ id, versao })) }, bearer);

describe('consultas do painel', () => {
  it('contabiliza os estados, restringe a visão por usuário e remove horas reabertas', async () => {
    const approved = await submitted();
    expect((await approve([approved])).status).toBe(200);
    await submitted({ data: '2026-01-16' });
    await create({ data: '2026-01-17' });
    const panel = await get('/painel');
    expect(panel.status).toBe(200);
    expect(panel.body.cargaHorariaMinutos).toBe(5400);
    expect(panel.body.registros).toEqual(expect.arrayContaining([
      { status: 'aprovado', quantidade: 1, minutos: 270 },
      { status: 'enviado', quantidade: 1, minutos: 270 },
      { status: 'rascunho', quantidade: 1, minutos: 270 },
    ]));
    const teacher = await get('/painel', teacherToken);
    expect(teacher.body.cargaHorariaMinutos).toBeNull();
    expect(teacher.body.registros.map((row: { status: string }) => row.status).sort()).toEqual(['aprovado', 'enviado']);
    for (const bearer of [otherStudentToken, otherTeacherToken]) {
      expect((await get('/painel', bearer)).body.registros).toEqual([]);
    }
    expect((await post(`/registros/${approved.id}/reabrir`, { versao: 3, motivo: 'Conferir atividades.' }, teacherToken)).status).toBe(200);
    const updated = await get('/painel');
    expect(updated.body.registros).not.toEqual(expect.arrayContaining([expect.objectContaining({ status: 'aprovado' })]));
    expect(updated.body.registros).toContainEqual({ status: 'devolvido', quantidade: 1, minutos: 270 });
    const listed = await get('/registros');
    expect(listed.body.registros.find((row: { id: string }) => row.id === approved.id).motivoDevolucao).toBe('Conferir atividades.');
  });

  it('inclui aluno e disciplina nas fichas sem expor fichas a terceiros', async () => {
    await submitted();
    const response = await get('/fichas', teacherToken);
    expect(response.status).toBe(200);
    expect(response.body.fichas[0].vinculo).toMatchObject({
      matricula: { aluno: { id: studentId, nome: 'Pessoa Fictícia' } },
      estagio: { id: stageId, disciplina: { nome: 'Disciplina Fictícia' }, campoEstagio: { nome: 'Hospital Fictício' }, turma: { codigo: 'TESTE' } },
    });
    for (const bearer of [otherStudentToken, otherTeacherToken]) expect((await get('/fichas', bearer)).body.fichas).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('senhaHash');
  });
});
const hours = (bearer = studentToken) => get(`/alunos/${studentId}/horas`, bearer);

describe('aprovação e totalização de horas', () => {
  it('aprova um registro com snapshot e permite consulta pelos três perfis', async () => {
    const record = await submitted();
    const response = await approve([record]);
    expect(response.status).toBe(200);
    const approved = response.body.aprovacoes[0];
    expect(approved.registro.status).toBe('aprovado');
    expect(approved.registro.versao).toBe(3);
    expect(approved.aprovacao.snapshot.registro.atividades).toBe(body().atividades);
    expect(approved.aprovacao.snapshot.registro.duracaoMinutos).toBe(270);
    expect(approved.aprovacao.snapshot.ficha.vinculo.estagio.codigo).toBe('TESTE');
    expect(approved.aprovacao.snapshot.professora).toMatchObject({ nome: 'Pessoa Fictícia', coren: null });
    for (const bearer of [studentToken, teacherToken, coordinatorToken]) {
      const approvals = await get(`/registros/${record.id}/aprovacoes`, bearer);
      expect(approvals.status).toBe(200);
      expect(approvals.body.aprovacoes).toHaveLength(1);
      expect(approvals.body.aprovacoes[0].vigente).toBe(true);
      expect((await get('/registros?status=aprovado', bearer)).body.registros).toHaveLength(1);
    }
    const historic = (await get(`/registros/${record.id}/historico`)).body.historico;
    expect(historic[0].acao).toBe('aprovado');
  });

  it('aprova até cinco registros da mesma ficha de uma vez', async () => {
    const records = [];
    for (let i = 8; i < 13; i++) records.push(await submitted({ horaInicio: `${i.toString().padStart(2, '0')}:00`, horaFim: `${(i + 1).toString().padStart(2, '0')}:00` }));
    expect((await approve(records)).status).toBe(200);
    expect(await context.prisma.aprovacaoRegistro.count()).toBe(5);
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(300);
  });

  it('rejeita lote vazio, mais de cinco, repetição, versão inválida e campos extras', async () => {
    const record = await submitted();
    expect((await approve([])).status).toBe(400);
    expect((await approve(Array.from({ length: 6 }, () => record))).status).toBe(400);
    expect((await approve([record, record])).status).toBe(400);
    expect((await approve([{ id: record.id, versao: 0 }])).status).toBe(400);
    expect((await post('/registros/aprovar', { registros: [{ id: record.id, versao: 2, duracaoMinutos: 999 }] }, teacherToken)).status).toBe(400);
    expect(await context.prisma.aprovacaoRegistro.count()).toBe(0);
  });

  it('não aprova nada quando um dos itens está desatualizado', async () => {
    const first = await submitted();
    const second = await submitted({ horaInicio: '13:00', horaFim: '14:00' });
    const result = await approve([first, { ...second, versao: 1 }]);
    expect(result.status).toBe(409);
    expect(await context.prisma.aprovacaoRegistro.count()).toBe(0);
    expect(await context.prisma.registroEstagio.count({ where: { status: 'enviado' } })).toBe(2);
    expect(await context.prisma.eventoRegistro.count()).toBe(4);
  });

  it('não aprova lote que contém rascunho ou devolvido', async () => {
    const sent = await submitted();
    const draft = await create({ horaInicio: '13:00', horaFim: '14:00' });
    expect((await approve([sent, draft])).status).toBe(404);
    const returned = await post(`/registros/${sent.id}/devolver`, { versao: 2, motivo: 'Corrigir descrição.' }, teacherToken);
    expect(returned.status).toBe(200);
    expect((await approve([returned.body.registro])).status).toBe(409);
    expect(await context.prisma.aprovacaoRegistro.count()).toBe(0);
  });

  it('desfaz todo o lote quando ocorre falha depois de aprovar o primeiro item', async () => {
    const records = [await submitted(), await submitted({ horaInicio: '13:00', horaFim: '14:00' })];
    const lastId = records.map((r) => r.id).sort().at(-1)!;
    // The generated UUID is trusted test data; this trigger exists only in the temporary local database.
    await context.database.exec(`CREATE FUNCTION rejeitar_aprovacao_teste() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.registro_id = '${lastId}'::uuid THEN RAISE EXCEPTION 'Falha fictícia'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER rejeitar_aprovacao_teste BEFORE INSERT ON aprovacao_registro FOR EACH ROW EXECUTE FUNCTION rejeitar_aprovacao_teste();`);
    try {
      expect((await approve(records)).status).toBe(500);
      expect(await context.prisma.aprovacaoRegistro.count()).toBe(0);
      expect(await context.prisma.registroEstagio.count({ where: { status: 'enviado' } })).toBe(2);
      expect(await context.prisma.eventoRegistro.count()).toBe(4);
    } finally {
      await context.database.exec('DROP TRIGGER rejeitar_aprovacao_teste ON aprovacao_registro; DROP FUNCTION rejeitar_aprovacao_teste();');
    }
  });

  it('bloqueia aprovação por aluno, coordenação e professora de outro grupo', async () => {
    const record = await submitted();
    for (const bearer of [studentToken, coordinatorToken]) expect((await approve([record], bearer)).status).toBe(403);
    expect((await approve([record], otherTeacherToken)).status).toBe(404);
    expect((await get(`/registros/${record.id}/aprovacoes`, otherStudentToken)).status).toBe(404);
    expect((await get(`/registros/${record.id}/aprovacoes`, otherTeacherToken)).status).toBe(404);
    expect((await hours(otherStudentToken)).status).toBe(404);
    expect((await hours(otherTeacherToken)).status).toBe(404);
  });

  it('aprova uma única vez em requisições simultâneas', async () => {
    const record = await submitted();
    const responses = await Promise.all([approve([record]), approve([record])]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await context.prisma.aprovacaoRegistro.count()).toBe(1);
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(270);
  });

  it('impede editar, reenviar, cancelar ou devolver diretamente um aprovado', async () => {
    const record = await submitted();
    await approve([record]);
    expect((await edit(record.id, 3)).status).toBe(409);
    expect((await post(`/registros/${record.id}/enviar`, { versao: 3 })).status).toBe(409);
    expect((await post(`/registros/${record.id}/cancelar`, { versao: 3 })).status).toBe(409);
    expect((await post(`/registros/${record.id}/devolver`, { versao: 3, motivo: 'Corrigir.' }, teacherToken)).status).toBe(409);
    expect((await approve([{ id: record.id, versao: 3 }])).status).toBe(409);
  });

  it('reabre com motivo, retira horas e preserva aprovação anterior ao corrigir e aprovar novamente', async () => {
    const record = await submitted();
    const original = (await approve([record])).body.aprovacoes[0].aprovacao;
    const reopened = await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Ajustar horário informado.' }, teacherToken);
    expect(reopened.status).toBe(200);
    expect(reopened.body.registro.status).toBe('devolvido');
    expect(reopened.body.registro.versao).toBe(4);
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(0);
    expect((await get(`/registros/${record.id}/aprovacoes`)).body.aprovacoes[0]).toMatchObject({ id: original.id, vigente: false, reabertura: { motivo: 'Ajustar horário informado.' } });
    expect((await edit(record.id, 4, { horaFim: '12:00', atividades: 'Atividade fictícia corrigida.' })).status).toBe(200);
    await post(`/registros/${record.id}/enviar`, { versao: 5 });
    expect((await approve([{ id: record.id, versao: 6 }])).status).toBe(200);
    const approvals = (await get(`/registros/${record.id}/aprovacoes`)).body.aprovacoes;
    expect(approvals).toHaveLength(2);
    expect(approvals[0].vigente).toBe(true);
    expect(approvals[1].vigente).toBe(false);
    expect(approvals[1].snapshot).toEqual(original.snapshot);
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(240);
    const history = (await get(`/registros/${record.id}/historico`)).body.historico;
    expect(history.find((e: { acao: string }) => e.acao === 'reaberto').motivo).toBe('Ajustar horário informado.');
  });

  it('exige professora responsável, motivo e versão atual para reabrir', async () => {
    const record = await submitted();
    await approve([record]);
    for (const bearer of [studentToken, coordinatorToken]) expect((await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Corrigir.' }, bearer)).status).toBe(403);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Corrigir.' }, otherTeacherToken)).status).toBe(404);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: ' ' }, teacherToken)).status).toBe(400);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 2, motivo: 'Corrigir.' }, teacherToken)).status).toBe(409);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Corrigir.' }, teacherToken)).status).toBe(200);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 4, motivo: 'Corrigir novamente.' }, teacherToken)).status).toBe(409);
  });

  it('reaberturas simultâneas invalidam a aprovação uma única vez', async () => {
    const record = await submitted();
    await approve([record]);
    const responses = await Promise.all([
      post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Corrigir.' }, teacherToken),
      post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Outro motivo.' }, teacherToken),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await context.prisma.reaberturaAprovacao.count()).toBe(1);
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(0);
  });

  it('não conta rascunhos, devolvidos ou cancelados como aprovados ou enviados', async () => {
    await create();
    const sent = await submitted({ horaInicio: '13:00', horaFim: '14:00' });
    const returned = await submitted({ horaInicio: '14:00', horaFim: '15:00' });
    await post(`/registros/${returned.id}/devolver`, { versao: 2, motivo: 'Corrigir.' }, teacherToken);
    const canceled = await create({ horaInicio: '15:00', horaFim: '16:00' });
    await post(`/registros/${canceled.id}/cancelar`, { versao: 1 });
    expect((await hours()).body.disciplinas[0]).toMatchObject({ minutosAprovados: 0, minutosEnviados: 60, cargaHorariaMinutos: 5400, minutosRestantes: 5400, minutosExcedentes: 0 });
    await approve([sent]);
    expect((await hours(coordinatorToken)).body.disciplinas[0]).toMatchObject({ minutosAprovados: 60, minutosEnviados: 0, minutosRestantes: 5340 });
  });

  it('retorna carga e zero horas mesmo antes de existir ficha', async () => {
    const response = await hours();
    expect(response.status).toBe(200);
    expect(response.body.escopo).toBe('aluno_na_instituicao');
    expect(response.body.disciplinas[0]).toMatchObject({ minutosAprovados: 0, minutosEnviados: 0, minutosRestantes: 5400 });
    expect((await get(`/alunos/${studentId}/horas?pagina=2`)).body.disciplinas).toHaveLength(0);
    expect((await get(`/alunos/${studentId}/horas?pagina=0`)).status).toBe(400);
  });

  it('soma a disciplina entre vínculos históricos e limita a professora aos seus grupos', async () => {
    const first = await submitted();
    await approve([first]);
    const db = context.prisma;
    const oldLink = await db.vinculoEstagio.update({ where: { id: linkId }, data: { encerradoEm: new Date('2026-01-16T12:00:00Z') } });
    const stage = await db.estagio.findUniqueOrThrow({ where: { id: stageId } });
    const otherTeacher = await db.usuario.findUniqueOrThrow({ where: { email: 'prof2@example.test' } });
    const nextStage = await db.estagio.create({ data: { ...stage, id: undefined, codigo: 'OUTRO', professoraId: otherTeacher.id } });
    const nextLink = await db.vinculoEstagio.create({ data: { ...oldLink, id: undefined, estagioId: nextStage.id, iniciadoEm: new Date('2026-01-17T12:00:00Z'), encerradoEm: null } });
    const second = await submitted({ vinculoId: nextLink.id, data: '2026-01-18' });
    expect((await approve([second], otherTeacherToken)).status).toBe(200);
    const complete = (await hours()).body;
    expect(complete.disciplinas).toHaveLength(1);
    expect(complete.disciplinas[0].minutosAprovados).toBe(540);
    for (const bearer of [teacherToken, otherTeacherToken]) {
      const partial = (await hours(bearer)).body;
      expect(partial.escopo).toBe('grupos_da_professora');
      expect(partial.disciplinas[0]).toMatchObject({ minutosAprovados: 270, minutosRestantes: null, minutosExcedentes: null });
    }
  });

  it('rejeita lote com duas fichas mesmo que sejam da mesma professora', async () => {
    const first = await submitted();
    const db = context.prisma;
    const oldLink = await db.vinculoEstagio.update({ where: { id: linkId }, data: { encerradoEm: new Date('2026-01-16T12:00:00Z') } });
    const newLink = await db.vinculoEstagio.create({ data: { ...oldLink, id: undefined, iniciadoEm: new Date('2026-01-17T12:00:00Z'), encerradoEm: null } });
    const second = await submitted({ vinculoId: newLink.id, data: '2026-01-18' });
    expect((await approve([first, second])).status).toBe(400);
    expect(await db.aprovacaoRegistro.count()).toBe(0);
  });

  it('mantém snapshot e reabertura imutáveis no banco e habilita RLS', async () => {
    const record = await submitted();
    const approval = (await approve([record])).body.aprovacoes[0].aprovacao;
    const db = context.prisma;
    await db.usuario.updateMany({ where: { email: 'prof@example.test' }, data: { nome: 'Nome fictício alterado', coren: 'COREN-FICTICIO' } });
    expect((await get(`/registros/${record.id}/aprovacoes`)).body.aprovacoes[0].snapshot.professora.nome).toBe('Pessoa Fictícia');
    await expect(db.aprovacaoRegistro.update({ where: { id: approval.id }, data: { snapshot: {} } })).rejects.toThrow();
    await expect(db.aprovacaoRegistro.delete({ where: { id: approval.id } })).rejects.toThrow();
    const reopened = await post(`/registros/${record.id}/reabrir`, { versao: 3, motivo: 'Corrigir.' }, teacherToken);
    await expect(db.reaberturaAprovacao.update({ where: { id: reopened.body.reabertura.id }, data: { motivo: 'Apagar motivo anterior.' } })).rejects.toThrow();
    await expect(db.reaberturaAprovacao.delete({ where: { id: reopened.body.reabertura.id } })).rejects.toThrow();
    const tables = await db.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname IN ('aprovacao_registro', 'reabertura_aprovacao')`;
    expect(tables).toHaveLength(2);
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
  });

  it('não contabiliza status aprovado sem aprovação da versão corrente', async () => {
    const record = await submitted();
    await context.prisma.registroEstagio.update({ where: { id: record.id }, data: { status: 'aprovado' } });
    expect((await hours()).body.disciplinas[0].minutosAprovados).toBe(0);
    expect((await post(`/registros/${record.id}/reabrir`, { versao: 2, motivo: 'Corrigir.' }, teacherToken)).status).toBe(409);
  });

  it('isola as aprovações e totais de outra instituição', async () => {
    const record = await submitted();
    await approve([record]);
    const db = context.prisma;
    const institution = await db.instituicao.create({ data: { nome: 'Outra Escola Fictícia' } });
    const saved = await db.usuario.findUniqueOrThrow({ where: { email: 'prof@example.test' } });
    const foreign = await db.usuario.create({ data: { instituicaoId: institution.id, nome: 'Outra Professora', email: 'estrangeira@example.test', perfil: 'professora', senhaHash: saved.senhaHash } });
    const bearer = await createTokenService(process.env.JWT_SECRET).issue(foreign.id, 0);
    expect((await approve([record], bearer)).status).toBe(404);
    expect((await get(`/registros/${record.id}/aprovacoes`, bearer)).status).toBe(404);
    expect((await hours(bearer)).status).toBe(404);
    await expect(db.aprovacaoRegistro.create({ data: { instituicaoId: institution.id, registroId: record.id, professoraId: foreign.id, versao: 99, snapshot: {} } })).rejects.toThrow();
  });
});
