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
    expect((await get('/registros?status=aprovado')).status).toBe(400);
    expect((await get('/registros?pagina=0')).status).toBe(400);
    expect((await get('/registros?alunoId=' + studentId)).status).toBe(400);
  });
});
