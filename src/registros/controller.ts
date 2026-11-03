import type { Request, Response } from 'express';
import type { Actor } from '../auth/user-select.js';
import { listSchema, userIdSchema } from '../auth/schemas.js';
import { createRecordSchema, editRecordSchema, versionSchema, returnRecordSchema, recordQuerySchema, approveBatchSchema } from './schemas.js';
import * as service from './service.js';
import * as approval from './approval-service.js';
import * as queries from './query-service.js';

const actor = (res: Response) => res.locals.actor as Actor;
const id = (req: Request) => userIdSchema.parse(req.params.id);
const page = (req: Request) => listSchema.parse(req.query).pagina;
export async function panel(_req: Request, res: Response) { res.json(await queries.panel(actor(res))); }
export async function approve(req: Request, res: Response) { res.json(await approval.approveRecords(actor(res), approveBatchSchema.parse(req.body))); }
export async function reopen(req: Request, res: Response) { const { versao, motivo } = returnRecordSchema.parse(req.body); res.json(await approval.reopenRecord(actor(res), id(req), versao, motivo)); }
export async function approvals(req: Request, res: Response) { res.json(await approval.listApprovals(actor(res), id(req), page(req))); }
export async function hours(req: Request, res: Response) { res.json(await approval.studentHours(actor(res), id(req), page(req))); }
export async function sheets(req: Request, res: Response) { const pagina = page(req); res.json({ fichas: await queries.listSheets(actor(res), pagina), pagina, porPagina: 50 }); }
export async function create(req: Request, res: Response) { res.status(201).json({ registro: await service.createRecord(actor(res), createRecordSchema.parse(req.body)) }); }
export async function list(req: Request, res: Response) { const { pagina, fichaId, status } = recordQuerySchema.parse(req.query); res.json({ registros: await queries.listRecords(actor(res), pagina, { fichaId, status }), pagina, porPagina: 50 }); }
export async function find(req: Request, res: Response) { res.json({ registro: await queries.findRecord(actor(res), id(req)) }); }
export async function history(req: Request, res: Response) { const pagina = page(req); res.json({ historico: await queries.history(actor(res), id(req), pagina), pagina, porPagina: 50 }); }
export async function edit(req: Request, res: Response) { const input = editRecordSchema.parse(req.body); res.json({ registro: await service.changeRecord(actor(res), id(req), input.versao, 'editar', input) }); }
export async function send(req: Request, res: Response) { res.json({ registro: await service.changeRecord(actor(res), id(req), versionSchema.parse(req.body).versao, 'enviar') }); }
export async function returnRecord(req: Request, res: Response) { const { versao, motivo } = returnRecordSchema.parse(req.body); res.json({ registro: await service.changeRecord(actor(res), id(req), versao, 'devolver', undefined, motivo) }); }
export async function cancel(req: Request, res: Response) { res.json({ registro: await service.changeRecord(actor(res), id(req), versionSchema.parse(req.body).versao, 'cancelar') }); }
