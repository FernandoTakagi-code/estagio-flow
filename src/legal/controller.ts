import type { Request, Response, NextFunction } from 'express';
import type { Actor } from '../auth/user-select.js';
import { legalConfig } from './config.js';
import * as service from './service.js';
export const documents = (_req: Request, res: Response) => { res.json(legalConfig()); };
export async function status(_req: Request, res: Response) { res.json({ pendente: await service.pending((res.locals.actor as Actor).id) }); }
export async function receipts(_req: Request, res: Response) { res.json({ registros: await service.ownReceipts((res.locals.actor as Actor).id) }); }
export async function acknowledge(req: Request, res: Response) { await service.acknowledge((res.locals.actor as Actor).id, service.acknowledgementSchema.parse(req.body)); res.status(204).end(); }
export async function requireAcknowledgement(_req: Request, res: Response, next: NextFunction) { if (await service.pending((res.locals.actor as Actor).id)) { res.status(428).json({ erro: 'Confira os documentos de uso e privacidade para continuar.' }); return; } next(); }
