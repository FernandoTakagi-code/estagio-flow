import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startTestDatabase } from './helpers/database.js';
import { createTokenService } from '../src/auth/token.js';
import type { Express } from 'express';

let context: Awaited<ReturnType<typeof startTestDatabase>>;
let app: Express;
let schoolId: string;
let coordinatorId: string;
let token: string;
let student: { id: string };
let student2: { id: string };
let teacher: { id: string };
let teacher2: { id: string };
let studentToken: string;
let teacherToken: string;
let teacher2Token: string;
let classId: string;
let class2Id: string;
let disciplineId: string;
let discipline2Id: string;
let fieldId: string;

beforeAll(async () => { context = await startTestDatabase(); });
beforeEach(async () => {
  if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Banco de teste precisa ser local.');
  const db = context.prisma;
  await db.$executeRawUnsafe('TRUNCATE instituicao, usuario, turma CASCADE');
  schoolId = (await db.instituicao.create({ data: { nome: 'Escola Fictícia' } })).id;
  const coordinator = await context.createCoordinator({ nome: 'Coordenação Fictícia', email: 'coord@example.test', instituicaoId: schoolId, senha: 'SenhaFicticiaParaTeste2026!' });
  coordinatorId = coordinator.id;
  const saved = await db.usuario.findUniqueOrThrow({ where: { id: coordinator.id } });
  const base = { instituicaoId: schoolId, criadoPorId: coordinator.id, nome: 'Pessoa Fictícia', senhaHash: saved.senhaHash };
  student = await db.usuario.create({ data: { ...base, email: 'aluno1@example.test', perfil: 'aluno' } });
  student2 = await db.usuario.create({ data: { ...base, email: 'aluno2@example.test', perfil: 'aluno' } });
  teacher = await db.usuario.create({ data: { ...base, email: 'prof1@example.test', perfil: 'professora', coren: 'COREN-FICTICIO-01' } });
  teacher2 = await db.usuario.create({ data: { ...base, email: 'prof2@example.test', perfil: 'professora' } });
  const tokens = createTokenService(process.env.JWT_SECRET);
  token = await tokens.issue(coordinator.id, 0);
  studentToken = await tokens.issue(student.id, 0);
  teacherToken = await tokens.issue(teacher.id, 0);
  teacher2Token = await tokens.issue(teacher2.id, 0);
  classId = (await db.turma.create({ data: { instituicaoId: schoolId, codigo: 'ENF-01' } })).id;
  class2Id = (await db.turma.create({ data: { instituicaoId: schoolId, codigo: 'ENF-02' } })).id;
  disciplineId = (await db.disciplina.create({ data: { instituicaoId: schoolId, codigo: 'FUND', nome: 'Fundamentos Fictício', cargaHorariaTotal: 90 } })).id;
  discipline2Id = (await db.disciplina.create({ data: { instituicaoId: schoolId, codigo: 'COLETIVA', nome: 'Saúde Coletiva Fictícia', cargaHorariaTotal: 30 } })).id;
  fieldId = (await db.campoEstagio.create({ data: { instituicaoId: schoolId, nome: 'Hospital Fictício' } })).id;
  app = context.createApp();
});
afterAll(async () => {
  await context?.prisma.$disconnect();
  await context?.socket.stop();
  await context?.database.close();
});

const enroll = (alunoId = student.id, turmaId = classId) => request(app).put(`/academico/alunos/${alunoId}/turma`).auth(token, { type: 'bearer' }).send({ turmaId });
const stageInput = (codigo: string, overrides: Record<string, string> = {}) => ({ codigo, turmaId: classId, disciplinaId: disciplineId, campoEstagioId: fieldId, professoraId: teacher.id, ...overrides });
async function group(codigo = 'GRUPO-01', overrides: Record<string, string> = {}) {
  const response = await request(app).post('/academico/estagios').auth(token, { type: 'bearer' }).send(stageInput(codigo, overrides));
  expect(response.status).toBe(201);
  return response.body.estagio.id as string;
}
const assign = (id: string, alunoId = student.id) => request(app).post(`/academico/estagios/${id}/alunos`).auth(token, { type: 'bearer' }).send({ alunoId });
const get = (path: string, bearer = token) => request(app).get('/academico' + path).auth(bearer, { type: 'bearer' });

describe('cadastros acadêmicos', () => {
  it('permite à coordenação criar e listar turmas, disciplinas e locais', async () => {
    const turma = await request(app).post('/academico/turmas').auth(token, { type: 'bearer' }).send({ codigo: ' enf-nova ' });
    expect(turma.status).toBe(201);
    expect(turma.body.turma.codigo).toBe('ENF-NOVA');
    expect((await request(app).post('/academico/disciplinas').auth(token, { type: 'bearer' }).send({ codigo: 'nova', nome: 'Disciplina Fictícia', cargaHorariaTotal: 50 })).status).toBe(201);
    expect((await request(app).post('/academico/campos-estagio').auth(token, { type: 'bearer' }).send({ nome: 'Outro Local Fictício' })).status).toBe(201);
    expect((await get('/turmas')).body.turmas).toHaveLength(3);
    expect((await get('/disciplinas')).body.disciplinas).toHaveLength(3);
    expect((await get('/campos-estagio')).body.camposEstagio).toHaveLength(2);
  });

  it('rejeita carga inválida, duplicados e alteração de instituição pelo payload', async () => {
    for (const cargaHorariaTotal of [0, -1, 0.5, 10001]) {
      expect((await request(app).post('/academico/disciplinas').auth(token, { type: 'bearer' }).send({ codigo: 'NOVA', nome: 'Fictícia', cargaHorariaTotal })).status).toBe(400);
    }
    expect((await request(app).post('/academico/turmas').auth(token, { type: 'bearer' }).send({ codigo: 'enf-01' })).status).toBe(409);
    expect((await request(app).post('/academico/turmas').auth(token, { type: 'bearer' }).send({ codigo: 'NOVA', instituicaoId: schoolId })).status).toBe(400);
  });

  it('bloqueia gestão por aluno e professora e exige autenticação', async () => {
    expect((await request(app).get('/academico/estagios')).status).toBe(401);
    for (const bearer of [studentToken, teacherToken]) {
      expect((await get('/turmas', bearer)).status).toBe(403);
      expect((await request(app).post('/academico/disciplinas').auth(bearer, { type: 'bearer' }).send({ codigo: 'X', nome: 'Fictícia', cargaHorariaTotal: 10 })).status).toBe(403);
      expect((await request(app).put(`/academico/alunos/${student.id}/turma`).auth(bearer, { type: 'bearer' }).send({ turmaId: classId })).status).toBe(403);
      expect((await request(app).post('/academico/estagios').auth(bearer, { type: 'bearer' }).send(stageInput('X'))).status).toBe(403);
    }
  });

  it('isola cadastros de outras instituições e rejeita referências cruzadas', async () => {
    const other = await context.prisma.instituicao.create({ data: { nome: 'Outra Escola Fictícia' } });
    const otherClass = await context.prisma.turma.create({ data: { instituicaoId: other.id, codigo: 'OUTRA' } });
    expect((await get('/turmas')).body.turmas.map((row: { id: string }) => row.id)).not.toContain(otherClass.id);
    expect((await enroll(student.id, otherClass.id)).status).toBe(404);
    expect((await request(app).post('/academico/estagios').auth(token, { type: 'bearer' }).send(stageInput('CRUZADO', { turmaId: otherClass.id }))).status).toBe(404);
    await expect(context.prisma.estagio.create({ data: { ...stageInput('SQL-CRUZADO', { turmaId: otherClass.id }), instituicaoId: schoolId, criadoPorId: coordinatorId } })).rejects.toThrow();
  });

  it('seed cria dez disciplinas somando 600 horas sem duplicar na repetição', async () => {
    const run = promisify(execFile);
    const cli = new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url);
    const { fileURLToPath } = await import('node:url');
    for (let i = 0; i < 2; i++) {
      await run(process.execPath, [fileURLToPath(cli), 'prisma/seed.ts'], { cwd: process.cwd(), env: process.env, windowsHide: true, timeout: 15000 });
    }
    const rows = await context.prisma.disciplina.findMany({ where: { instituicaoId: '00000000-0000-4000-8000-000000000001' } });
    expect(rows).toHaveLength(10);
    expect(rows.reduce((total, row) => total + row.cargaHorariaTotal, 0)).toBe(600);
  });
});

describe('matrículas e grupos de estágio', () => {
  it('mantém uma turma ativa e preserva o histórico das transferências', async () => {
    expect((await enroll()).status).toBe(201);
    expect((await enroll()).status).toBe(200);
    const transferred = await enroll(student.id, class2Id);
    expect(transferred.status).toBe(201);
    expect(transferred.body.transferido).toBe(true);
    const history = await get(`/alunos/${student.id}/matriculas`);
    expect(history.body.matriculas).toHaveLength(2);
    expect(history.body.matriculas.filter((row: { encerradoEm: unknown }) => row.encerradoEm === null)).toHaveLength(1);
  });

  it('só matricula alunos ativos, não professoras ou contas desativadas', async () => {
    expect((await enroll(teacher.id)).status).toBe(404);
    await context.prisma.usuario.update({ where: { id: student.id }, data: { ativo: false } });
    expect((await enroll()).status).toBe(404);
  });

  it('exige professora ativa e do perfil correto no grupo', async () => {
    expect((await request(app).post('/academico/estagios').auth(token, { type: 'bearer' }).send(stageInput('INVALIDO', { professoraId: student.id }))).status).toBe(404);
    await context.prisma.usuario.update({ where: { id: teacher.id }, data: { ativo: false } });
    expect((await request(app).post('/academico/estagios').auth(token, { type: 'bearer' }).send(stageInput('INATIVA'))).status).toBe(404);
  });

  it('só vincula aluno com matrícula ativa na turma do grupo', async () => {
    const id = await group();
    expect((await assign(id)).status).toBe(409);
    await enroll(student.id, class2Id);
    expect((await assign(id)).status).toBe(409);
    await enroll();
    expect((await assign(id)).status).toBe(201);
    expect((await assign(id)).status).toBe(200);
    expect(await context.prisma.vinculoEstagio.count()).toBe(1);
  });

  it('professora só consulta seus grupos e aluno só vê seus próprios vínculos', async () => {
    const id = await group();
    const other = await group('GRUPO-OUTRO', { professoraId: teacher2.id });
    await enroll();
    await enroll(student2.id);
    await assign(id);
    await assign(id, student2.id);
    expect((await get('/estagios', teacherToken)).body.estagios.map((row: { id: string }) => row.id)).toEqual([id]);
    expect((await get(`/estagios/${other}`, teacherToken)).status).toBe(404);
    expect((await get(`/estagios/${id}/alunos`, teacherToken)).body.vinculos).toHaveLength(2);
    const own = await get(`/estagios/${id}/alunos`, studentToken);
    expect(own.body.vinculos).toHaveLength(1);
    expect(own.body.vinculos[0].matricula.aluno.id).toBe(student.id);
    expect(own.body.vinculos[0].matricula.aluno).not.toHaveProperty('email');
    expect(own.body.vinculos[0].matricula.aluno).not.toHaveProperty('senhaHash');
    expect((await get(`/estagios/${other}`, studentToken)).status).toBe(404);
  });

  it('troca grupo e professora sem apagar o vínculo anterior', async () => {
    const first = await group();
    const second = await group('GRUPO-NOVO', { professoraId: teacher2.id });
    await enroll();
    await assign(first);
    const transferred = await assign(second);
    expect(transferred.body.transferido).toBe(true);
    const old = await get(`/estagios/${first}/alunos`, teacherToken);
    expect(old.body.vinculos[0].encerradoEm).not.toBeNull();
    const current = await get(`/estagios/${second}/alunos`, teacher2Token);
    expect(current.body.vinculos[0].encerradoEm).toBeNull();
    expect((await get(`/estagios/${second}/alunos`, teacherToken)).status).toBe(404);
    expect(await context.prisma.vinculoEstagio.count({ where: { alunoId: student.id, encerradoEm: null } })).toBe(1);
  });

  it('permite grupos de disciplinas diferentes simultaneamente e fecha todos ao trocar de turma', async () => {
    const first = await group();
    const second = await group('OUTRA-DISCIPLINA', { disciplinaId: discipline2Id });
    await enroll();
    await assign(first);
    await assign(second);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(2);
    await enroll(student.id, class2Id);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(0);
    expect(await context.prisma.vinculoEstagio.count()).toBe(2);
    expect((await assign(first)).status).toBe(409);
  });

  it('não encerra matrícula ou estágio quando a turma de destino é inválida', async () => {
    const id = await group();
    await enroll();
    await assign(id);
    expect((await enroll(student.id, '00000000-0000-4000-8000-000000000099')).status).toBe(404);
    expect(await context.prisma.matriculaTurma.count({ where: { encerradoEm: null } })).toBe(1);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(1);
  });

  it('encerra só o vínculo escolhido e mantém a matrícula', async () => {
    const id = await group();
    await enroll();
    await assign(id);
    expect((await request(app).post(`/academico/estagios/${id}/alunos/${student.id}/encerrar`).auth(token, { type: 'bearer' })).status).toBe(204);
    expect(await context.prisma.vinculoEstagio.count()).toBe(1);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(0);
    expect(await context.prisma.matriculaTurma.count({ where: { encerradoEm: null } })).toBe(1);
  });

  it('encerra um grupo e seus vínculos sem apagar matrículas ou histórico', async () => {
    const id = await group();
    await enroll();
    await enroll(student2.id);
    await assign(id);
    await assign(id, student2.id);
    expect((await request(app).post(`/academico/estagios/${id}/encerrar`).auth(token, { type: 'bearer' })).status).toBe(204);
    expect((await assign(id)).status).toBe(409);
    expect(await context.prisma.vinculoEstagio.count()).toBe(2);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(0);
    expect(await context.prisma.matriculaTurma.count({ where: { encerradoEm: null } })).toBe(2);
    expect((await get(`/estagios/${id}`, teacherToken)).body.estagio.encerradoEm).not.toBeNull();
  });

  it('encerra a matrícula de aluno desativado e preserva a conta', async () => {
    const id = await group();
    await enroll();
    await assign(id);
    await context.prisma.usuario.update({ where: { id: student.id }, data: { ativo: false } });
    expect((await request(app).post(`/academico/alunos/${student.id}/turma/encerrar`).auth(token, { type: 'bearer' })).status).toBe(204);
    expect(await context.prisma.vinculoEstagio.count({ where: { encerradoEm: null } })).toBe(0);
    expect(await context.prisma.matriculaTurma.count({ where: { encerradoEm: null } })).toBe(0);
    expect(await context.prisma.usuario.findUnique({ where: { id: student.id } })).not.toBeNull();
  });

  it('serializa transferências concorrentes mantendo uma única matrícula ativa', async () => {
    const results = await Promise.all([enroll(), enroll(student.id, class2Id)]);
    expect(results.map((response) => response.status)).toEqual([201, 201]);
    expect(await context.prisma.matriculaTurma.count({ where: { alunoId: student.id, encerradoEm: null } })).toBe(1);
    expect(await context.prisma.matriculaTurma.count()).toBe(2);
  });

  it('serializa trocas concorrentes entre grupos da mesma disciplina', async () => {
    const first = await group();
    const second = await group('SEGUNDO-GRUPO', { professoraId: teacher2.id });
    await enroll();
    const results = await Promise.all([assign(first), assign(second)]);
    expect(results.every((result) => result.status === 201)).toBe(true);
    expect(await context.prisma.vinculoEstagio.count({ where: { alunoId: student.id, disciplinaId: disciplineId, encerradoEm: null } })).toBe(1);
    expect(await context.prisma.vinculoEstagio.count()).toBe(2);
  });

  it('banco impede matrículas e vínculos ativos duplicados mesmo fora das rotas', async () => {
    const id = await group();
    const enrollment = await enroll();
    await assign(id);
    await expect(context.prisma.matriculaTurma.create({ data: { instituicaoId: schoolId, alunoId: student.id, turmaId: class2Id, criadoPorId: coordinatorId } })).rejects.toThrow();
    await expect(context.prisma.vinculoEstagio.create({ data: { instituicaoId: schoolId, alunoId: student.id, turmaId: classId, disciplinaId: disciplineId, estagioId: id, matriculaId: enrollment.body.matricula.id, criadoPorId: coordinatorId } })).rejects.toThrow();
  });

  it('não mantém vínculo ativo quando inclusão e encerramento do grupo são simultâneos', async () => {
    const id = await group();
    await enroll();
    const [included, closed] = await Promise.all([
      assign(id),
      request(app).post(`/academico/estagios/${id}/encerrar`).auth(token, { type: 'bearer' }),
    ]);
    expect([201, 409]).toContain(included.status);
    expect(closed.status).toBe(204);
    expect(await context.prisma.vinculoEstagio.count({ where: { estagioId: id, encerradoEm: null } })).toBe(0);
  });

  it('banco rejeita carga horária não positiva e períodos invertidos', async () => {
    await expect(context.prisma.disciplina.create({ data: { instituicaoId: schoolId, codigo: 'ZERO', nome: 'Carga Inválida', cargaHorariaTotal: 0 } })).rejects.toThrow();
    await expect(context.prisma.matriculaTurma.create({ data: {
      instituicaoId: schoolId, alunoId: student.id, turmaId: classId, criadoPorId: coordinatorId,
      iniciadoEm: new Date('2026-01-02T00:00:00Z'), encerradoEm: new Date('2026-01-01T00:00:00Z'),
    } })).rejects.toThrow();
  });

  it('banco impede vincular matrícula de outro aluno ou grupo de outra turma', async () => {
    const id = await group();
    const enrollment = await enroll();
    await expect(context.prisma.vinculoEstagio.create({ data: { instituicaoId: schoolId, alunoId: student2.id, turmaId: classId, disciplinaId: disciplineId, estagioId: id, matriculaId: enrollment.body.matricula.id, criadoPorId: coordinatorId } })).rejects.toThrow();
    await expect(context.prisma.vinculoEstagio.create({ data: { instituicaoId: schoolId, alunoId: student.id, turmaId: class2Id, disciplinaId: disciplineId, estagioId: id, matriculaId: enrollment.body.matricula.id, criadoPorId: coordinatorId } })).rejects.toThrow();
  });

  it('RLS protege os cinco cadastros e vínculos contra acesso pela Data API', async () => {
    const id = await group();
    await enroll();
    await assign(id);
    await context.database.exec('CREATE ROLE anon NOLOGIN; GRANT USAGE ON SCHEMA public TO anon; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon; SET ROLE anon;');
    try {
      for (const table of ['disciplina', 'campo_estagio', 'matricula_turma', 'estagio', 'vinculo_estagio']) {
        expect((await context.database.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
      }
    } finally { await context.database.exec('RESET ROLE'); }
  });
});
