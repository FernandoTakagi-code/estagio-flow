import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { randomBytes, createHash } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Express } from 'express';
import { startTestDatabase } from './helpers/database.js';
import { createTokenService } from '../src/auth/token.js';
import { legalConfig } from '../src/legal/config.js';
import { emailConfig } from '../src/email/config.js';
let context: Awaited<ReturnType<typeof startTestDatabase>>; let app: Express;
let clearCaptureInbox: typeof import('../src/email/service.js').clearCaptureInbox;
let captureInbox: typeof import('../src/email/service.js').captureInbox;
let processEmails: typeof import('../src/email/service.js').processEmails;
let coordinatorId: string; let studentId: string; let studentToken: string; let coordinatorToken: string;
const password = 'SenhaFicticiaParaTeste2026!'; const newPassword = 'NovaSenhaFicticiaTeste2026!';
const requestReset = (email = 'aluno@example.test') => request(app).post('/auth/recuperacao').send({ email });
const reset = (token: string) => request(app).post('/auth/recuperacao/redefinir').send({ token, senha: newPassword });
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const payload = () => ({ aceitoTermos: true, cienciaPrivacidade: true, termosHash: legalConfig().documentos[0]!.hash, privacidadeHash: legalConfig().documentos[1]!.hash });
const acknowledge = (bearer = studentToken) => request(app).post('/legal/aceites').auth(bearer, { type: 'bearer' }).send(payload());
const policyFile = join(tmpdir(), `estagio-policy-test-${randomBytes(6).toString('hex')}.json`);
async function recoveryToken() { await requestReset(); await processEmails(); const mail = captureInbox().find((value) => value.to === 'aluno@example.test')!; return mail.text.match(/#recuperacao=([a-f0-9]{64})/)![1]!; }
beforeAll(async () => { context = await startTestDatabase(); ({ clearCaptureInbox, captureInbox, processEmails } = await import('../src/email/service.js')); });
beforeEach(async () => {
  process.env.EMAIL_MODE = 'capture'; process.env.EMAIL_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.PUBLIC_APP_URL = 'http://127.0.0.1:5173';
  delete process.env.LEGAL_DEMO_MODE; delete process.env.LEGAL_CONFIG_PATH; delete process.env.DEMO_EMAIL_INBOX; clearCaptureInbox();
  if (new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Teste exige banco local.');
  await context.prisma.$executeRawUnsafe('TRUNCATE usuario, instituicao, turma CASCADE');
  const school = await context.prisma.instituicao.create({ data: { nome: 'Escola Fictícia' } });
  const coordinator = await context.createCoordinator({ instituicaoId: school.id, nome: 'Coordenação Fictícia', email: 'coord@example.test', senha: password }); coordinatorId = coordinator.id;
  const credentials = await context.prisma.usuario.findUniqueOrThrow({ where: { id: coordinator.id } });
  const student = await context.prisma.usuario.create({ data: { instituicaoId: school.id, nome: 'Aluno Fictício', email: 'aluno@example.test', perfil: 'aluno', senhaHash: credentials.senhaHash } }); studentId = student.id;
  const tokens = createTokenService(process.env.JWT_SECRET); studentToken = await tokens.issue(student.id, 0); coordinatorToken = await tokens.issue(coordinator.id, 0);
  app = context.createApp();
});
afterEach(async () => { vi.unstubAllGlobals(); delete process.env.LEGAL_CONFIG_PATH; delete process.env.LEGAL_DEMO_MODE; await unlink(policyFile).catch(() => {}); });
afterAll(async () => { await context?.prisma.$disconnect(); await context?.socket.stop(); await context?.database.close(); });

describe('e-mails e recuperação', () => {
  it('não revela contas existentes, pendentes, desativadas ou inexistentes', async () => {
    const good = await requestReset(); const absent = await requestReset('naoexiste@example.test');
    expect(good.status).toBe(202); expect(absent.status).toBe(202); expect(good.body).toEqual(absent.body); expect(good.body).not.toHaveProperty('token');
    await context.prisma.usuario.update({ where: { id: studentId }, data: { ativo: false } }); expect((await requestReset()).body).toEqual(good.body);
    await context.prisma.usuario.update({ where: { id: studentId }, data: { ativo: true, senhaHash: null } }); expect((await requestReset()).body).toEqual(good.body);
    expect(await context.prisma.recuperacaoSenha.count()).toBe(1);
    expect((await request(app).get('/auth/demo-emails')).status).toBe(404);
  });
  it('cifra o e-mail na fila, captura localmente e elimina o conteúdo após o envio', async () => {
    await requestReset(); const queued = await context.prisma.mensagemEmail.findFirstOrThrow();
    expect(queued.conteudoCifrado).not.toContain('aluno@example.test'); expect(queued.conteudoCifrado).not.toContain('recuperacao=');
    await processEmails(); const token = captureInbox()[0]!.text.match(/#recuperacao=([a-f0-9]{64})/)![1]!;
    expect((await context.prisma.recuperacaoSenha.findFirstOrThrow()).tokenHash).toBe(digest(token));
    const sent = await context.prisma.mensagemEmail.findFirstOrThrow(); expect(sent.estado).toBe('enviada'); expect(sent.conteudoCifrado).toBeNull();
    await processEmails(); expect(captureInbox()).toHaveLength(1);
  });
  it('troca a senha uma vez e invalida as sessões anteriores', async () => {
    const token = await recoveryToken(); expect((await reset(token)).status).toBe(204); expect((await reset(token)).status).toBe(400);
    expect((await request(app).get('/auth/me').auth(studentToken, { type: 'bearer' })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'aluno@example.test', senha: password })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'aluno@example.test', senha: newPassword })).status).toBe(200);
  });
  it('rejeita tokens vencidos, contas desativadas e consumo concorrente', async () => {
    const token = await recoveryToken(); const row = await context.prisma.recuperacaoSenha.findFirstOrThrow();
    await context.prisma.recuperacaoSenha.update({ where: { id: row.id }, data: { expiraEm: new Date(Date.now() - 1000), criadoEm: new Date(Date.now() - 10000) } });
    expect((await reset(token)).status).toBe(400);
    await context.prisma.recuperacaoSenha.update({ where: { id: row.id }, data: { expiraEm: new Date(Date.now() + 60000) } });
    await context.prisma.usuario.update({ where: { id: studentId }, data: { ativo: false } }); expect((await reset(token)).status).toBe(400);
    await context.prisma.usuario.update({ where: { id: studentId }, data: { ativo: true } });
    const result = await Promise.all([reset(token), reset(token)]); expect(result.map((value) => value.status).sort()).toEqual([204, 400]);
  });
  it('limita pedidos por conta e preserva o link recente sem envio repetido', async () => {
    for (let index = 0; index < 5; index++) expect((await requestReset('  ALUNO@EXAMPLE.TEST  ')).status).toBe(202);
    expect((await requestReset()).status).toBe(429); expect(await context.prisma.recuperacaoSenha.count()).toBe(1); expect(await context.prisma.mensagemEmail.count()).toBe(1);
  });
  it('envia convites individuais e importados para a fila, cancelando versões revogadas', async () => {
    const created = await request(app).post('/usuarios').auth(coordinatorToken, { type: 'bearer' }).send({ nome: 'Convidado Fictício', email: 'novo@example.test', perfil: 'aluno' });
    expect(created.body.convite.email.estado).toBe('na_fila');
    await request(app).post(`/usuarios/${created.body.usuario.id}/convite`).auth(coordinatorToken, { type: 'bearer' });
    const preview = await request(app).post('/usuarios/importacoes/previa').auth(coordinatorToken, { type: 'bearer' }).set('Content-Type', 'text/csv').send('nome,email\nPessoa Fictícia,lote@example.test');
    const imported = await request(app).post(`/usuarios/importacoes/${preview.body.id}/confirmar`).auth(coordinatorToken, { type: 'bearer' }).send({ confirmar: true });
    expect(imported.status).toBe(201); expect(imported.body.alunos[0].convite.email.estado).toBe('na_fila');
    await processEmails(); expect(captureInbox()).toHaveLength(2); expect(await context.prisma.mensagemEmail.count({ where: { estado: 'cancelada' } })).toBe(1);
  });
  it('não envia referência expirada e usa idempotência estável no adaptador Resend', async () => {
    await requestReset(); const row = await context.prisma.recuperacaoSenha.findFirstOrThrow();
    await context.prisma.recuperacaoSenha.update({ where: { id: row.id }, data: { revogadoEm: new Date() } }); await processEmails(); expect(captureInbox()).toHaveLength(0);
    await context.prisma.recuperacaoSenha.deleteMany();
    process.env.EMAIL_MODE = 'resend'; process.env.PUBLIC_APP_URL = 'https://portal.example.test'; process.env.RESEND_API_KEY = 'resend-test-key'; process.env.EMAIL_FROM = 'portal@example.test';
    const sender = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{"id":"test-message"}', { status: 200 })); vi.stubGlobal('fetch', sender);
    await requestReset(); await processEmails(); const pending = await context.prisma.mensagemEmail.findFirstOrThrow({ where: { estado: 'pendente' } });
    await context.prisma.mensagemEmail.update({ where: { id: pending.id }, data: { disponivelEm: new Date(Date.now() - 1000) } }); await processEmails();
    expect(sender).toHaveBeenCalledTimes(2); const first = sender.mock.calls[0]![1] as RequestInit; const second = sender.mock.calls[1]![1] as RequestInit;
    expect((first.headers as Record<string, string>)['Idempotency-Key']).toBe((second.headers as Record<string, string>)['Idempotency-Key']);
    expect(await context.prisma.mensagemEmail.count({ where: { estado: 'enviada' } })).toBe(1);
  });
  it('recusa captura em banco remoto e origem insegura para envio real', () => {
    const original = process.env.DATABASE_URL; process.env.DATABASE_URL = 'postgresql://example:example@remote.example.test/db'; expect(() => emailConfig()).toThrow(); process.env.DATABASE_URL = original;
    process.env.EMAIL_MODE = 'resend'; process.env.PUBLIC_APP_URL = 'http://portal.example.test'; expect(() => emailConfig()).toThrow();
  });
});

describe('documentos de uso e privacidade', () => {
  it('mantém rascunhos sem aceite forçado e não trata ciência como consentimento genérico', async () => {
    const docs = await request(app).get('/legal/documentos'); expect(docs.body).toMatchObject({ estado: 'rascunho', exigido: false });
    expect((await acknowledge()).status).toBe(409); expect(await context.prisma.registroLegal.count()).toBe(0);
  });
  it('bloqueia acesso até o registro explícito de ambos os documentos, sem duplicar registros', async () => {
    process.env.LEGAL_DEMO_MODE = 'true';
    expect((await request(app).get('/frequencia/painel').auth(studentToken, { type: 'bearer' })).status).toBe(428);
    expect((await request(app).post('/legal/aceites').auth(studentToken, { type: 'bearer' }).send({ ...payload(), cienciaPrivacidade: false })).status).toBe(400);
    expect((await acknowledge()).status).toBe(204); expect((await acknowledge()).status).toBe(204);
    expect(await context.prisma.registroLegal.count()).toBe(2);
    expect((await request(app).get('/frequencia/painel').auth(studentToken, { type: 'bearer' })).status).toBe(200);
    const receipts = await request(app).get('/legal/meus-registros').auth(studentToken, { type: 'bearer' });
    expect(receipts.body.registros.find((value: { tipo: string }) => value.tipo === 'privacidade').snapshot.manifestacao).toBe('ciencia_aviso');
    expect((await request(app).get('/legal/meus-registros').auth(coordinatorToken, { type: 'bearer' })).body.registros).toEqual([]);
  });
  it('registra os documentos junto à ativação e rejeita versões antigas sem consumir o convite', async () => {
    const created = await request(app).post('/usuarios').auth(coordinatorToken, { type: 'bearer' }).send({ nome: 'Convidado Fictício', email: 'novo@example.test', perfil: 'aluno' });
    process.env.LEGAL_DEMO_MODE = 'true'; const token = created.body.convite.token;
    const accept = (documentos?: object) => request(app).post('/auth/convites/aceitar').send({ token, senha: password, ...(documentos ? { documentos } : {}) });
    expect((await accept()).status).toBe(428);
    expect((await accept({ ...payload(), termosHash: 'a'.repeat(64) })).status).toBe(428);
    expect((await context.prisma.conviteUsuario.findUniqueOrThrow({ where: { tokenHash: digest(token) } })).usadoEm).toBeNull();
    expect((await accept(payload())).status).toBe(204); expect(await context.prisma.registroLegal.count()).toBe(2);
  });
  it('pede nova manifestação quando o texto muda e preserva os documentos anteriores', async () => {
    process.env.LEGAL_DEMO_MODE = 'true'; await acknowledge(); delete process.env.LEGAL_DEMO_MODE;
    const base = { revisadoPelaInstituicao: true, controlador: 'Instituição Fictícia', contato: 'privacidade@example.test', termos: { versao: '2', titulo: 'Termos fictícios de teste', texto: 'Texto fictício para testar o versionamento e o aceite específico dos termos de uso da aplicação.' }, privacidade: { versao: '2', titulo: 'Aviso fictício de teste', texto: 'Texto fictício para testar o versionamento da ciência do aviso de privacidade da aplicação.' } };
    await writeFile(policyFile, JSON.stringify(base)); process.env.LEGAL_CONFIG_PATH = policyFile;
    expect((await request(app).get('/legal/status').auth(studentToken, { type: 'bearer' })).body.pendente).toBe(true);
    expect((await acknowledge()).status).toBe(204); expect(await context.prisma.registroLegal.count()).toBe(4);
    await expect(context.prisma.registroLegal.updateMany({ where: { usuarioId: studentId }, data: { origem: 'convite' } })).rejects.toThrow();
    await expect(context.prisma.registroLegal.deleteMany({ where: { usuarioId: studentId } })).rejects.toThrow();
  });
  it('habilita RLS nas três tabelas novas e não publica documentos fictícios em produção', async () => {
    const flags = await context.prisma.$queryRawUnsafe<{ relrowsecurity: boolean }[]>("SELECT relrowsecurity FROM pg_class WHERE relname IN ('recuperacao_senha','mensagem_email','registro_legal')"); expect(flags).toHaveLength(3); expect(flags.every((flag) => flag.relrowsecurity)).toBe(true);
    const original = process.env.NODE_ENV; process.env.NODE_ENV = 'production'; try { expect(() => legalConfig()).toThrow(); } finally { process.env.NODE_ENV = original; }
    expect((await request(app).get('/legal/meus-registros')).status).toBe(401);
  });
});
