import type { Request, Response } from 'express';
import type { Actor } from '../auth/user-select.js';
import { userIdSchema, listSchema } from '../auth/schemas.js';
import * as service from './service.js';
import * as schemas from './schemas.js';
export async function list(req: Request, res: Response) { const query = schemas.querySchema.parse(req.query); res.json({ sessoes: await service.list(res.locals.actor as Actor, query), pagina: query.pagina, porPagina: 50 }); }
export async function create(req: Request, res: Response) { res.status(201).json({ sessao: await service.create(res.locals.actor as Actor, schemas.createSchema.parse(req.body)) }); }
export async function detail(req: Request, res: Response) { res.json(await service.detail(res.locals.actor as Actor, userIdSchema.parse(req.params.id))); }
export async function edit(req: Request, res: Response) { const input = schemas.editSchema.parse(req.body); res.json({ sessao: await service.change(res.locals.actor as Actor, userIdSchema.parse(req.params.id), input.versao, input.motivo, input) }); }
export async function cancel(req: Request, res: Response) { const input = schemas.cancelSchema.parse(req.body); res.json({ sessao: await service.change(res.locals.actor as Actor, userIdSchema.parse(req.params.id), input.versao, input.motivo) }); }
export async function mark(req: Request, res: Response) { res.json({ frequencia: await service.mark(res.locals.actor as Actor, userIdSchema.parse(req.params.id), schemas.frequencySchema.parse(req.body)) }); }
export async function markBatch(req: Request, res: Response) { const { lancamentos } = schemas.batchFrequencySchema.parse(req.body); res.json({ frequencias: await service.markBatch(res.locals.actor as Actor, userIdSchema.parse(req.params.id), lancamentos) }); }
export async function history(req: Request, res: Response) { const { pagina } = listSchema.parse(req.query); res.json({ historico: await service.history(res.locals.actor as Actor, userIdSchema.parse(req.params.id), pagina), pagina, porPagina: 50 }); }
