import type { Request, Response } from 'express';
import { z } from 'zod';
import { setTimeout as delay } from 'node:timers/promises';
import { emailSchema, passwordSchema } from '../auth/schemas.js';
import * as service from './service.js';
const requestSchema = z.object({ email: emailSchema }).strict();
const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), senha: passwordSchema }).strict();
export async function requestRecovery(req: Request, res: Response) { const started = Date.now(); await service.requestRecovery(requestSchema.parse(req.body).email); await delay(Math.max(0, 250 - (Date.now() - started))); res.status(202).json({ mensagem: 'Se houver uma conta ativa com esse e-mail, você receberá as instruções de recuperação.' }); }
export async function reset(req: Request, res: Response) { const input = resetSchema.parse(req.body); await service.resetPassword(input.token, input.senha); res.status(204).end(); }
