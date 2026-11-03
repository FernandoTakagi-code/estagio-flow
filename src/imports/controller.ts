import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Actor } from '../auth/user-select.js';
import { userIdSchema } from '../auth/schemas.js';
import { HttpError } from '../lib/errors.js';
import { previewImport, confirmImport } from './service.js';
export async function preview(req: Request, res: Response) {
  if (!req.is('text/csv')) throw new HttpError(415, 'Envie o CSV com Content-Type text/csv.');
  res.json(await previewImport(res.locals.actor as Actor, req.body));
}
export async function confirm(req: Request, res: Response) {
  const id = userIdSchema.parse(req.params.id);
  z.strictObject({ confirmar: z.literal(true) }).parse(req.body);
  res.status(201).json(await confirmImport(res.locals.actor as Actor, id));
}
