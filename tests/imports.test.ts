import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startTestDatabase } from './helpers/database.js';
import { createTokenService } from '../src/auth/token.js';
import type { Express } from 'express';

let context: Awaited<ReturnType<typeof startTestDatabase>>;
let app: Express;
let actor: { id: string; instituicaoId: string };
let token: string;
const csv = 'nome,email\nAluno Um,um@example.test\nAluno Dois,dois@example.test';
const password = 'SenhaFicticiaParaTeste2026!';

const preview = (text = csv, bearer = token) => request(app).post('/usuarios/importacoes/previa')
  .auth(bearer, { type: 'bearer' }).set('Content-Type', 'text/csv; charset=utf-8').send(text);
const confirm = (id: string, bearer = token) => request(app).post(`/usuarios/importacoes/${id}/confirmar`)
  .auth(bearer, { type: 'bearer' }).send({ confirmar: true });

beforeAll(async () => { context = await startTestDatabase(); });
beforeEach(async () => {
  if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Banco de teste precisa ser local.');
  await context.prisma.$executeRawUnsafe('TRUNCATE importacao_alunos, convite_usuario, usuario, turma, instituicao CASCADE');
  const school = await context.prisma.instituicao.create({ data: { nome: 'Escola Fictícia' } });
  actor = await context.createCoordinator({ nome: 'Coordenação Fictícia', email: 'coordenacao@example.test', instituicaoId: school.id, senha: password });
  token = await createTokenService(process.env.JWT_SECRET).issue(actor.id, 0);
  app = context.createApp();
});
afterAll(async () => {
  await context?.prisma.$disconnect();
  await context?.socket.stop();
  await context?.database.close();
});

describe('importação de alunos', () => {
  it('mostra a prévia sem criar contas e só cria alunos e convites na confirmação', async () => {
    const response = await preview();
    expect(response.status).toBe(200);
    expect(response.body.podeConfirmar).toBe(true);
    expect(response.body.quantidade).toBe(2);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(await context.prisma.usuario.count()).toBe(1);
    expect(await context.prisma.conviteUsuario.count()).toBe(0);
    const imported = await confirm(response.body.id);
    expect(imported.status).toBe(201);
    expect(imported.body.quantidade).toBe(2);
    expect(await context.prisma.usuario.count()).toBe(3);
    expect(await context.prisma.conviteUsuario.count()).toBe(2);
    for (const student of imported.body.alunos) {
      expect(student.perfil).toBe('aluno');
      expect(student).not.toHaveProperty('senhaHash');
      expect(student.convite.token).toHaveLength(64);
    }
    const stored = await context.prisma.importacaoAlunos.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.dados).toBeNull();
    expect(stored.confirmadaEm).not.toBeNull();
    const accepted = await request(app).post('/auth/convites/aceitar').send({ token: imported.body.alunos[0].convite.token, senha: password });
    expect(accepted.status).toBe(204);
    const login = await request(app).post('/auth/login').send({ email: 'um@example.test', senha: password });
    expect(login.status).toBe(200);
  });

  it('aceita BOM, ponto e vírgula, cabeçalho invertido e normaliza e-mail', async () => {
    const response = await preview('\uFEFF\r\n\r\nemail;nome\r\n  ALUNO@EXAMPLE.TEST  ; Aluno Fictício \r\n');
    expect(response.status).toBe(200);
    expect(response.body.podeConfirmar).toBe(true);
    expect(response.body.alunos[0]).toMatchObject({ email: 'aluno@example.test', nome: 'Aluno Fictício' });
  });

  it('trata vírgulas e quebras de linha dentro de campos entre aspas', async () => {
    const response = await preview('nome,email\n"Silva, Ana",ana@example.test\n"Nome\nComposto",nome@example.test');
    expect(response.body.podeConfirmar).toBe(true);
    expect(response.body.alunos[0].nome).toBe('Silva, Ana');
    expect(response.body.alunos[1].linha).toBe(4);
  });

  it('aponta dados inválidos e duplicados sem criar uma prévia confirmável', async () => {
    const response = await preview('nome,email\nA,nao-email\nAluno Um,repetido@example.test\nAluno Dois,REPETIDO@example.test\nCoordenação,coordenacao@example.test');
    expect(response.status).toBe(200);
    expect(response.body.podeConfirmar).toBe(false);
    expect(response.body.id).toBeNull();
    expect(response.body.alunos.every((row: { erros: string[] }) => row.erros.length > 0)).toBe(true);
    expect(await context.prisma.importacaoAlunos.count()).toBe(0);
    expect(await context.prisma.usuario.count()).toBe(1);
  });

  it('rejeita outras colunas, cabeçalhos duplicados e CSV malformado', async () => {
    for (const malformed of ['nome,email,perfil\nAluno,aluno@example.test,coordenacao', 'nome,nome\nAluno,Outro', 'nome,email\n"Aluno,aluno@example.test', 'nome,email\nAluno']) {
      expect((await preview(malformed)).status).toBe(400);
    }
    expect(await context.prisma.usuario.count()).toBe(1);
  });

  it('limita tamanho e quantidade de registros e exige text/csv', async () => {
    expect((await preview('nome,email')).status).toBe(400);
    const many = 'nome,email\n' + Array.from({ length: 101 }, (_, i) => `Aluno ${i},aluno${i}@example.test`).join('\n');
    expect((await preview(many)).status).toBe(400);
    expect((await preview('x'.repeat(65537))).status).toBe(413);
    expect((await request(app).post('/usuarios/importacoes/previa').auth(token, { type: 'bearer' }).send({ csv })).status).toBe(415);
  });

  it('processa o lote máximo de 100 alunos', async () => {
    const many = 'nome,email\n' + Array.from({ length: 100 }, (_, i) => `Aluno ${i},aluno${i}@example.test`).join('\n');
    const response = await preview(many);
    const imported = await confirm(response.body.id);
    expect(imported.status).toBe(201);
    expect(imported.body.alunos).toHaveLength(100);
    expect(await context.prisma.conviteUsuario.count()).toBe(100);
  });

  it('exige confirmação explícita e não aceita substituir os dados da prévia', async () => {
    const response = await preview();
    const path = `/usuarios/importacoes/${response.body.id}/confirmar`;
    expect((await request(app).post(path).auth(token, { type: 'bearer' }).send({ confirmar: false })).status).toBe(400);
    expect((await request(app).post(path).auth(token, { type: 'bearer' }).send({ confirmar: true, alunos: [{ perfil: 'coordenacao' }] })).status).toBe(400);
    expect(await context.prisma.usuario.count()).toBe(1);
  });

  it('não duplica um lote confirmado duas vezes', async () => {
    const response = await preview();
    expect((await confirm(response.body.id)).status).toBe(201);
    expect((await confirm(response.body.id)).status).toBe(409);
    expect(await context.prisma.usuario.count()).toBe(3);
  });

  it('permite somente uma confirmação simultânea', async () => {
    const response = await preview();
    const results = await Promise.all([confirm(response.body.id), confirm(response.body.id)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await context.prisma.usuario.count()).toBe(3);
    expect(await context.prisma.conviteUsuario.count()).toBe(2);
  });

  it('reverte todo o lote se um e-mail for cadastrado depois da prévia', async () => {
    const response = await preview();
    await context.prisma.usuario.create({ data: { instituicaoId: actor.instituicaoId, criadoPorId: actor.id, nome: 'Aluno Existente', email: 'dois@example.test', perfil: 'aluno' } });
    expect((await confirm(response.body.id)).status).toBe(409);
    expect(await context.prisma.usuario.count()).toBe(2);
    expect(await context.prisma.usuario.findUnique({ where: { email: 'um@example.test' } })).toBeNull();
    expect(await context.prisma.conviteUsuario.count()).toBe(0);
    const stored = await context.prisma.importacaoAlunos.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.confirmadaEm).toBeNull();
    expect(stored.dados).not.toBeNull();
  });

  it('recusa prévia expirada e limpa seus dados pessoais ao gerar outra', async () => {
    const response = await preview();
    await context.prisma.importacaoAlunos.update({ where: { id: response.body.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await confirm(response.body.id)).status).toBe(410);
    await preview('nome,email\nOutro Aluno,outro@example.test');
    const stored = await context.prisma.importacaoAlunos.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.dados).toBeNull();
  });

  it('restringe confirmação ao criador da prévia e à instituição dele', async () => {
    const response = await preview();
    const other = await context.createCoordinator({ nome: 'Outra Coordenação', email: 'outra@example.test', instituicaoId: actor.instituicaoId, senha: password });
    const otherToken = await createTokenService(process.env.JWT_SECRET).issue(other.id, 0);
    expect((await confirm(response.body.id, otherToken)).status).toBe(404);
    const school = await context.prisma.instituicao.create({ data: { nome: 'Outra Escola Fictícia' } });
    const otherSchool = await context.createCoordinator({ nome: 'Coordenação Escola', email: 'outra-escola@example.test', instituicaoId: school.id, senha: password });
    const thirdToken = await createTokenService(process.env.JWT_SECRET).issue(otherSchool.id, 0);
    expect((await confirm(response.body.id, thirdToken)).status).toBe(404);
  });

  it('impede alunos, professoras e visitantes de importar', async () => {
    expect((await request(app).post('/usuarios/importacoes/previa').set('Content-Type', 'text/csv').send(csv)).status).toBe(401);
    const existing = await context.prisma.usuario.findUniqueOrThrow({ where: { id: actor.id } });
    for (const perfil of ['aluno', 'professora'] as const) {
      const user = await context.prisma.usuario.create({ data: { instituicaoId: actor.instituicaoId, nome: 'Pessoa Fictícia', email: `${perfil}@example.test`, perfil, senhaHash: existing.senhaHash } });
      const bearer = await createTokenService(process.env.JWT_SECRET).issue(user.id, 0);
      expect((await preview(csv, bearer)).status).toBe(403);
    }
  });

  it('protege dados das prévias por RLS', async () => {
    await preview();
    expect(await context.prisma.importacaoAlunos.count()).toBe(1);
    await context.database.exec('CREATE ROLE anon NOLOGIN; GRANT USAGE ON SCHEMA public TO anon; GRANT SELECT ON importacao_alunos TO anon; SET ROLE anon;');
    try { expect((await context.database.query('SELECT * FROM importacao_alunos')).rows).toHaveLength(0); }
    finally { await context.database.exec('RESET ROLE'); }
  });
});
