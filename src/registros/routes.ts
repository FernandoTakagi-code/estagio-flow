import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import type { Actor } from '../auth/service.js';
import { userIdSchema, listSchema } from '../auth/schemas.js';
import { createRecordSchema, editRecordSchema, versionSchema, returnRecordSchema, recordQuerySchema } from './schemas.js';
import { createRecord, changeRecord, recordScope, sheetScope, presentRecord } from './service.js';

export function createRecordsRouter() {
  const router = Router();
  router.get('/fichas', async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const fichas = await prisma.fichaEstagio.findMany({ where: sheetScope(res.locals.actor as Actor),
      include: { vinculo: { select: { estagioId: true, iniciadoEm: true, encerradoEm: true } } },
      orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
    res.json({ fichas, pagina, porPagina: 50 });
  });
  router.post('/registros', async (req, res) => {
    const registro = await createRecord(res.locals.actor as Actor, createRecordSchema.parse(req.body));
    res.status(201).json({ registro });
  });
  router.get('/registros', async (req, res) => {
    const { pagina, fichaId, status } = recordQuerySchema.parse(req.query);
    const registros = await prisma.registroEstagio.findMany({
      where: { AND: [recordScope(res.locals.actor as Actor), { fichaId, status }] },
      orderBy: [{ data: 'desc' }, { inicioMinuto: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50,
    });
    res.json({ registros: registros.map(presentRecord), pagina, porPagina: 50 });
  });
  router.get('/registros/:id', async (req, res) => {
    const registro = await prisma.registroEstagio.findFirst({ where: { ...recordScope(res.locals.actor as Actor), id: userIdSchema.parse(req.params.id) } });
    if (!registro) throw new HttpError(404, 'Registro não encontrado.');
    res.json({ registro: presentRecord(registro) });
  });
  router.get('/registros/:id/historico', async (req, res) => {
    const actor = res.locals.actor as Actor;
    const id = userIdSchema.parse(req.params.id);
    const { pagina } = listSchema.parse(req.query);
    const registro = await prisma.registroEstagio.findFirst({ where: { ...recordScope(actor), id }, select: { id: true } });
    if (!registro) throw new HttpError(404, 'Registro não encontrado.');
    const historico = await prisma.eventoRegistro.findMany({
      where: { registroId: id, instituicaoId: actor.instituicaoId },
      orderBy: { versao: 'desc' }, take: 50, skip: (pagina - 1) * 50,
    });
    res.json({ historico, pagina, porPagina: 50 });
  });
  router.put('/registros/:id', async (req, res) => {
    const input = editRecordSchema.parse(req.body);
    const registro = await changeRecord(res.locals.actor as Actor, userIdSchema.parse(req.params.id), input.versao, 'editar', input);
    res.json({ registro });
  });
  router.post('/registros/:id/enviar', async (req, res) => {
    const { versao } = versionSchema.parse(req.body);
    const registro = await changeRecord(res.locals.actor as Actor, userIdSchema.parse(req.params.id), versao, 'enviar');
    res.json({ registro });
  });
  router.post('/registros/:id/devolver', async (req, res) => {
    const { versao, motivo } = returnRecordSchema.parse(req.body);
    const registro = await changeRecord(res.locals.actor as Actor, userIdSchema.parse(req.params.id), versao, 'devolver', undefined, motivo);
    res.json({ registro });
  });
  router.post('/registros/:id/cancelar', async (req, res) => {
    const { versao } = versionSchema.parse(req.body);
    const registro = await changeRecord(res.locals.actor as Actor, userIdSchema.parse(req.params.id), versao, 'cancelar');
    res.json({ registro });
  });
  return router;
}
