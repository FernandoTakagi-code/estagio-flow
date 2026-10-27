import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import type { Express } from 'express';
import { startTestDatabase } from './helpers/database.js';

let database: PGlite;
let socket: PGLiteSocketServer;
let prisma: typeof import('../src/lib/prisma.js').prisma;
let createApp: typeof import('../src/app.js').createApp;
let createCoordinator: typeof import('../src/auth/service.js').createCoordinator;
let app: Express;
let coordinator: { id: string; instituicaoId: string };
let coordinatorToken: string;
const password = 'SenhaFicticiaParaTeste2026!';
const coordinatorEmail = 'coordenacao@example.test';

async function login(email = coordinatorEmail, senha = password) {
  return request(app).post('/auth/login').send({ email, senha });
}
async function invite(email = 'aluno@example.test', perfil = 'aluno', bearer = coordinatorToken) {
  return request(app).post('/usuarios').auth(bearer, { type: 'bearer' })
    .send({ nome: 'Pessoa Fictícia', email, perfil });
}
async function accept(token: string) {
  return request(app).post('/auth/convites/aceitar').send({ token, senha: password });
}
function me(token: string) {
  return request(app).get('/auth/me').auth(token, { type: 'bearer' });
}

beforeAll(async () => {
  ({ database, socket, prisma, createApp, createCoordinator } = await startTestDatabase());
});

beforeEach(async () => {
  if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Testes exigem banco local isolado.');
  await prisma.$executeRawUnsafe('TRUNCATE convite_usuario, usuario, turma, instituicao CASCADE');
  const instituicao = await prisma.instituicao.create({ data: { nome: 'Escola Fictícia de Teste' } });
  coordinator = await createCoordinator({ nome: 'Coordenação Fictícia', email: coordinatorEmail, instituicaoId: instituicao.id, senha: password });
  app = createApp();
  const response = await login();
  expect(response.status).toBe(200);
  coordinatorToken = response.body.accessToken;
});

afterAll(async () => {
  await prisma?.$disconnect();
  await socket?.stop();
  await database?.close();
});

describe('autenticação e autorização', () => {
  it('normaliza o e-mail no login, emite JWT e não expõe hash ou versão de sessão', async () => {
    const response = await login('  COORDENACAO@EXAMPLE.TEST  ');
    expect(response.status).toBe(200);
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.usuario).not.toHaveProperty('senhaHash');
    expect(response.body.usuario).not.toHaveProperty('tokenVersao');
    const profile = await me(response.body.accessToken);
    expect(profile.status).toBe(200);
    expect(profile.body.usuario.id).toBe(coordinator.id);
    expect(profile.body.usuario).not.toHaveProperty('senhaHash');
    expect(profile.headers['cache-control']).toBe('no-store');
  });

  it('retorna o mesmo erro para senha errada e conta inexistente', async () => {
    const wrong = await login(coordinatorEmail, 'senha-incorreta');
    const missing = await login('inexistente@example.test');
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
    expect((await request(app).get('/auth/me')).status).toBe(401);
  });

  it('rejeita assinatura inválida, expiração e outro emissor', async () => {
    expect((await me('token-invalido')).status).toBe(401);
    for (const issuer of ['estagio-flow', 'outro-emissor']) {
      const token = await new SignJWT({ versao: 0 }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(coordinator.id).setIssuedAt().setJti('teste')
        .setIssuer(issuer).setAudience('estagio-flow-api')
        .setExpirationTime(issuer === 'estagio-flow' ? Math.floor(Date.now() / 1000) - 1 : '15m')
        .sign(Buffer.from(process.env.JWT_SECRET!, 'hex'));
      expect((await me(token)).status).toBe(401);
    }
    const forged = await new SignJWT({ versao: 0 }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(coordinator.id).setIssuedAt().setJti('teste').setIssuer('estagio-flow')
      .setAudience('estagio-flow-api').setExpirationTime('15m').sign(randomBytes(32));
    expect((await me(forged)).status).toBe(401);
  });

  it('invalida os tokens anteriores no logout', async () => {
    const second = await login();
    const response = await request(app).post('/auth/logout').auth(coordinatorToken, { type: 'bearer' });
    expect(response.status).toBe(204);
    expect((await me(coordinatorToken)).status).toBe(401);
    expect((await me(second.body.accessToken)).status).toBe(401);
    expect((await login()).status).toBe(200);
  });

  it('limita tentativas de login por e-mail', async () => {
    let status = 0;
    for (let i = 0; i < 10; i++) status = (await login(coordinatorEmail, 'senha-incorreta')).status;
    expect(status).toBe(429);
  });

  it('rejeita payload extra, JSON inválido e requisição grande', async () => {
    expect((await request(app).post('/auth/login').send({ email: coordinatorEmail, senha: password, perfil: 'coordenacao' })).status).toBe(400);
    expect((await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{')).status).toBe(400);
    expect((await request(app).post('/auth/login').send({ email: coordinatorEmail, senha: 'a'.repeat(20000) })).status).toBe(413);
  });
});

describe('cadastro e convites', () => {
  it('não oferece cadastro público', async () => {
    expect((await request(app).post('/usuarios').send({ nome: 'Aluno', email: 'aluno@example.test', perfil: 'aluno' })).status).toBe(401);
    expect((await request(app).post('/auth/register').send({})).status).toBe(404);
  });

  it('cria por convite, guarda apenas o hash do token e permite usar uma vez', async () => {
    const created = await invite('  ALUNO@EXAMPLE.TEST  ');
    expect(created.status).toBe(201);
    expect(created.body.usuario.email).toBe('aluno@example.test');
    expect(created.body.usuario).not.toHaveProperty('senhaHash');
    const stored = await prisma.conviteUsuario.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(created.body.convite.token);
    expect(stored.criadoPorId).toBe(coordinator.id);
    expect((await login('aluno@example.test')).status).toBe(401);
    expect((await accept(created.body.convite.token)).status).toBe(204);
    expect((await accept(created.body.convite.token)).status).toBe(400);
    expect((await login('aluno@example.test')).status).toBe(200);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: created.body.usuario.id } })).senhaHash).not.toBe(password);
  });

  it('permite criar professora e bloqueia elevar perfil ou informar outra instituição', async () => {
    expect((await invite('professora@example.test', 'professora')).status).toBe(201);
    expect((await invite('outra-coordenacao@example.test', 'coordenacao')).status).toBe(400);
    const response = await request(app).post('/usuarios').auth(coordinatorToken, { type: 'bearer' })
      .send({ nome: 'Aluno', email: 'outro@example.test', perfil: 'aluno', instituicaoId: coordinator.instituicaoId });
    expect(response.status).toBe(400);
    expect((await invite('PROFESSORA@example.test', 'professora')).status).toBe(409);
    expect(await prisma.usuario.count()).toBe(2);
    expect(await prisma.conviteUsuario.count()).toBe(1);
  });

  it('impede aluno e professora de criar, listar ou desativar contas', async () => {
    for (const perfil of ['aluno', 'professora']) {
      const created = await invite(`${perfil}@example.test`, perfil);
      await accept(created.body.convite.token);
      const session = await login(`${perfil}@example.test`);
      const token = session.body.accessToken;
      expect((await invite('negado@example.test', 'aluno', token)).status).toBe(403);
      expect((await request(app).get('/usuarios').auth(token, { type: 'bearer' })).status).toBe(403);
      expect((await request(app).patch(`/usuarios/${coordinator.id}/ativo`).auth(token, { type: 'bearer' }).send({ ativo: false })).status).toBe(403);
    }
  });

  it('rejeita convite expirado, inexistente e senha curta', async () => {
    const created = await invite();
    expect((await request(app).post('/auth/convites/aceitar').send({ token: created.body.convite.token, senha: 'curta' })).status).toBe(400);
    await prisma.conviteUsuario.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    expect((await accept(created.body.convite.token)).status).toBe(400);
    expect((await accept(randomBytes(32).toString('hex'))).status).toBe(400);
  });

  it('aceita somente uma ativação quando o mesmo convite chega simultaneamente', async () => {
    const created = await invite();
    const results = await Promise.all([accept(created.body.convite.token), accept(created.body.convite.token)]);
    expect(results.map((result) => result.status).sort()).toEqual([204, 400]);
    expect((await login('aluno@example.test')).status).toBe(200);
  });

  it('revoga o convite anterior ao reemitir e não permite reemitir após ativação', async () => {
    const created = await invite();
    const reissued = await request(app).post(`/usuarios/${created.body.usuario.id}/convite`).auth(coordinatorToken, { type: 'bearer' });
    expect(reissued.status).toBe(201);
    expect((await accept(created.body.convite.token)).status).toBe(400);
    expect((await accept(reissued.body.convite.token)).status).toBe(204);
    expect((await request(app).post(`/usuarios/${created.body.usuario.id}/convite`).auth(coordinatorToken, { type: 'bearer' })).status).toBe(404);
  });

  it('desativa sem apagar histórico e impede reutilizar token mesmo após reativação', async () => {
    const created = await invite();
    await accept(created.body.convite.token);
    const session = await login('aluno@example.test');
    const path = `/usuarios/${created.body.usuario.id}/ativo`;
    expect((await request(app).patch(path).auth(coordinatorToken, { type: 'bearer' }).send({ ativo: false })).status).toBe(200);
    expect((await login('aluno@example.test')).status).toBe(401);
    expect((await me(session.body.accessToken)).status).toBe(401);
    expect(await prisma.conviteUsuario.count()).toBe(1);
    await request(app).patch(path).auth(coordinatorToken, { type: 'bearer' }).send({ ativo: true });
    expect((await me(session.body.accessToken)).status).toBe(401);
    expect((await login('aluno@example.test')).status).toBe(200);
  });

  it('revoga convites ao desativar uma conta pendente', async () => {
    const created = await invite();
    const path = `/usuarios/${created.body.usuario.id}/ativo`;
    await request(app).patch(path).auth(coordinatorToken, { type: 'bearer' }).send({ ativo: false });
    expect((await accept(created.body.convite.token)).status).toBe(400);
    await request(app).patch(path).auth(coordinatorToken, { type: 'bearer' }).send({ ativo: true });
    expect((await accept(created.body.convite.token)).status).toBe(400);
  });

  it('restringe consultas e alterações à instituição da coordenação', async () => {
    const created = await invite();
    const otherSchool = await prisma.instituicao.create({ data: { nome: 'Outra Escola Fictícia' } });
    await createCoordinator({ nome: 'Outra Coordenação', email: 'outra@example.test', instituicaoId: otherSchool.id, senha: password });
    const session = await login('outra@example.test');
    const token = session.body.accessToken;
    const listed = await request(app).get('/usuarios').auth(token, { type: 'bearer' });
    expect(listed.body.usuarios).toHaveLength(1);
    expect(listed.body.usuarios[0].instituicaoId).toBe(otherSchool.id);
    expect((await request(app).post(`/usuarios/${created.body.usuario.id}/convite`).auth(token, { type: 'bearer' })).status).toBe(404);
    expect((await request(app).patch(`/usuarios/${created.body.usuario.id}/ativo`).auth(token, { type: 'bearer' }).send({ ativo: false })).status).toBe(404);
    expect((await request(app).patch(`/usuarios/${coordinator.id}/ativo`).auth(coordinatorToken, { type: 'bearer' }).send({ ativo: false })).status).toBe(404);
  });

  it('mantém RLS habilitado sem políticas na tabela de convites', async () => {
    await invite();
    expect(await prisma.conviteUsuario.count()).toBe(1);
    const rows = await database.query<{ rls: boolean }>("SELECT relrowsecurity AS rls FROM pg_class WHERE relname='convite_usuario'");
    expect(rows.rows[0]?.rls).toBe(true);
    await database.exec('CREATE ROLE anon NOLOGIN; GRANT USAGE ON SCHEMA public TO anon; GRANT SELECT ON convite_usuario TO anon; SET ROLE anon;');
    try { expect((await database.query('SELECT * FROM convite_usuario')).rows).toHaveLength(0); }
    finally { await database.exec('RESET ROLE'); }
  });
});
