import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { ZodError, z } from 'zod';
import { prisma } from './lib/prisma.js';
import { Prisma } from './generated/prisma/client.js';
import { HttpError } from './lib/errors.js';
import { createTokenService, tokenDurationSeconds } from './auth/token.js';
import { requireAuth, requireCoordinator } from './auth/middleware.js';
import { loginSchema, acceptInviteSchema, createUserSchema, userIdSchema, activeSchema, listSchema } from './auth/schemas.js';
import { authenticate, acceptInvite, createUser, reissueInvite, setUserActive, publicUserSelect, type Actor } from './auth/service.js';
import { previewImport, confirmImport } from './imports/service.js';

export function createApp() {
  const tokens = createTokenService(process.env.JWT_SECRET);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  const auth = requireAuth(tokens);
  const limitMessage = { erro: 'Muitas tentativas. Tente novamente mais tarde.' };
  const ipLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000, limit: 100,
    standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage,
  });
  const loginAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage,
    keyGenerator: (req) => createHash('sha256')
      .update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '')
      .digest('hex'),
  });

  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.post('/auth/login', ipLimiter(), loginAccountLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, tokenVersao } = await authenticate(input.email, input.senha);
    const accessToken = await tokens.issue(user.id, tokenVersao);
    res.json({ accessToken, tokenType: 'Bearer', expiresIn: tokenDurationSeconds, usuario: user });
  });

  app.post('/auth/convites/aceitar', ipLimiter(), async (req, res) => {
    const input = acceptInviteSchema.parse(req.body);
    await acceptInvite(input.token, input.senha);
    res.status(204).end();
  });

  app.get('/auth/me', auth, (_req, res) => { res.json({ usuario: res.locals.actor }); });
  app.post('/auth/logout', auth, async (_req, res) => {
    const actor = res.locals.actor as Actor;
    await prisma.usuario.update({ where: { id: actor.id }, data: { tokenVersao: { increment: 1 } } });
    res.status(204).end();
  });

  app.use('/usuarios', auth, requireCoordinator, (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage,
    keyGenerator: (_req, res) => (res.locals.actor as Actor).id,
  });
  app.post('/usuarios/importacoes/previa', importLimiter, express.text({ type: 'text/csv', limit: '64kb' }), async (req, res) => {
    if (!req.is('text/csv')) throw new HttpError(415, 'Envie o CSV com Content-Type text/csv.');
    const result = await previewImport(res.locals.actor as Actor, req.body);
    res.json(result);
  });
  app.post('/usuarios/importacoes/:id/confirmar', importLimiter, async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    z.strictObject({ confirmar: z.literal(true) }).parse(req.body);
    const result = await confirmImport(res.locals.actor as Actor, id);
    res.status(201).json(result);
  });
  app.post('/usuarios', async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const result = await createUser(res.locals.actor as Actor, input);
    res.status(201).json(result);
  });
  app.get('/usuarios', async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const usuarios = await prisma.usuario.findMany({
      where: { instituicaoId: actor.instituicaoId }, select: publicUserSelect,
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }], skip: (pagina - 1) * 50, take: 50,
    });
    res.json({ usuarios, pagina, porPagina: 50 });
  });
  app.post('/usuarios/:id/convite', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const convite = await reissueInvite(res.locals.actor as Actor, id);
    res.status(201).json({ convite });
  });
  app.patch('/usuarios/:id/ativo', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const { ativo } = activeSchema.parse(req.body);
    const usuario = await setUserActive(res.locals.actor as Actor, id, ativo);
    res.json({ usuario });
  });

  app.use((_req, res) => { res.status(404).json({ erro: 'Rota não encontrada.' }); });
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({ erro: 'Dados inválidos.', campos: error.issues.map((issue) => ({ campo: issue.path.join('.'), mensagem: issue.message })) });
    } else if (error instanceof HttpError) {
      res.status(error.status).json({ erro: error.message });
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ erro: 'Não foi possível cadastrar: dados já utilizados.' });
    } else if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
      res.status(400).json({ erro: 'JSON inválido.' });
    } else if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      res.status(413).json({ erro: 'Corpo da requisição excede o limite permitido.' });
    } else {
      console.error('Falha interna ao processar a requisição.');
      res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
  };
  app.use(errorHandler);
  return app;
}
