import type { Request, Response } from 'express';
import type { Actor } from '../auth/user-select.js';
import { createUserSchema, userIdSchema, activeSchema } from '../auth/schemas.js';
import * as accounts from '../auth/service.js';
import * as service from './service.js';
import { userQuerySchema } from './schemas.js';

const actor = (res: Response) => res.locals.actor as Actor;
export async function list(req: Request, res: Response) { res.json(await service.listUsers(actor(res), userQuerySchema.parse(req.query))); }
export async function find(req: Request, res: Response) { res.json({ usuario: await service.findPerson(actor(res), userIdSchema.parse(req.params.id)) }); }
export async function create(req: Request, res: Response) { res.status(201).json(await accounts.createUser(actor(res), createUserSchema.parse(req.body))); }
export async function reissue(req: Request, res: Response) { res.status(201).json({ convite: await accounts.reissueInvite(actor(res), userIdSchema.parse(req.params.id)) }); }
export async function active(req: Request, res: Response) { res.json({ usuario: await accounts.setUserActive(actor(res), userIdSchema.parse(req.params.id), activeSchema.parse(req.body).ativo) }); }
