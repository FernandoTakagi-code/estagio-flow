import express, { type ErrorRequestHandler } from 'express';
import * as recovery from './recovery/controller.js';
import * as legal from './legal/controller.js';
import { legalConfig } from './legal/config.js';
import { emailConfig } from './email/config.js';
import { captureInbox } from './email/service.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { ZodError } from 'zod';
import { createAuthController } from './auth/controller.js';
import * as users from './usuarios/controller.js';
import * as imports from './imports/controller.js';
import { Prisma } from './generated/prisma/client.js';
import { HttpError } from './lib/errors.js';
import { createTokenService } from './auth/token.js';
import { requireAuth, requireCoordinator } from './auth/middleware.js';
import type { Actor } from './auth/user-select.js';
import { createAcademicRouter } from './academico/routes.js';
import { createAgendaRouter } from './agenda/routes.js';
import { createRecordsRouter } from './registros/routes.js';

export function createApp() {
  legalConfig();
  const mailConfig = emailConfig();
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

  const authentication = createAuthController(tokens);
  app.post('/auth/login', ipLimiter(), loginAccountLimiter, authentication.login);
  app.post('/auth/convites/aceitar', ipLimiter(), authentication.accept);
  const recoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage, keyGenerator: (req) => createHash('sha256').update(typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '').digest('hex') });
  app.get('/auth/opcoes', (_req, res) => { res.json({ recuperacaoDisponivel: mailConfig.mode !== 'disabled', caixaDemonstracao: mailConfig.mode === 'capture' && process.env.DEMO_EMAIL_INBOX === 'true' }); });
  app.post('/auth/recuperacao', ipLimiter(), recoveryLimiter, recovery.requestRecovery);
  app.post('/auth/recuperacao/redefinir', ipLimiter(), recovery.reset);
  if (mailConfig.mode === 'capture' && process.env.DEMO_EMAIL_INBOX === 'true') app.get('/auth/demo-emails', (_req, res) => { res.json({ mensagens: captureInbox() }); });
  app.get('/auth/me', auth, authentication.me);
  app.post('/auth/logout', auth, authentication.logout);
  app.use('/legal', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/legal/documentos', legal.documents);
  app.get('/legal/status', auth, legal.status);
  app.get('/legal/meus-registros', auth, legal.receipts);
  app.post('/legal/aceites', auth, legal.acknowledge);

  app.use('/usuarios', auth, legal.requireAcknowledgement, requireCoordinator, (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage,
    keyGenerator: (_req, res) => (res.locals.actor as Actor).id,
  });
  app.post('/usuarios/importacoes/previa', importLimiter, express.text({ type: 'text/csv', limit: '64kb' }), imports.preview);
  app.post('/usuarios/importacoes/:id/confirmar', importLimiter, imports.confirm);
  app.post('/usuarios', users.create);
  app.get('/usuarios', users.list);
  app.get('/usuarios/:id', users.find);
  app.post('/usuarios/:id/convite', users.reissue);
  app.patch('/usuarios/:id/ativo', users.active);

  app.use('/academico', auth, legal.requireAcknowledgement, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, createAcademicRouter());
  app.use('/frequencia', auth, legal.requireAcknowledgement, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, createRecordsRouter());
  app.use('/agenda', auth, legal.requireAcknowledgement, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, createAgendaRouter());

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
