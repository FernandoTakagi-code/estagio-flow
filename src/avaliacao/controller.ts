import type { Request, Response } from 'express';
import type { Actor } from '../auth/user-select.js';
import { userIdSchema, listSchema } from '../auth/schemas.js';
import * as service from './service.js';
export async function read(req: Request, res: Response) { res.json(await service.read(res.locals.actor as Actor, userIdSchema.parse(req.params.id), listSchema.parse(req.query).pagina)); }
export async function publish(req: Request, res: Response) { res.status(201).json({ avaliacao: await service.publish(res.locals.actor as Actor, userIdSchema.parse(req.params.id), service.assessmentSchema.parse(req.body)) }); }
export async function monitoring(req: Request, res: Response) { res.json(await service.monitoring(res.locals.actor as Actor, listSchema.parse(req.query).pagina)); }
