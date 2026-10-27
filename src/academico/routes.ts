import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireCoordinator } from '../auth/middleware.js';
import { userIdSchema, listSchema } from '../auth/schemas.js';
import type { Actor } from '../auth/service.js';
import { HttpError } from '../lib/errors.js';
import { turmaSchema, disciplinaSchema, campoSchema, matriculaSchema, alunoSchema, estagioSchema } from './schemas.js';
import { setStudentClass, closeStudentClass, createStage, assignStudent, closeStage, closeStudentStage, stageScope, stageSelect } from './service.js';

export function createAcademicRouter() {
  const router = Router();

  router.post('/turmas', requireCoordinator, async (req, res) => {
    const data = turmaSchema.parse(req.body);
    const actor = res.locals.actor as Actor;
    const turma = await prisma.turma.create({ data: { ...data, instituicaoId: actor.instituicaoId } });
    res.status(201).json({ turma });
  });
  router.get('/turmas', requireCoordinator, async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const turmas = await prisma.turma.findMany({ where: { instituicaoId: actor.instituicaoId }, orderBy: [{ codigo: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
    res.json({ turmas, pagina, porPagina: 50 });
  });
  router.post('/disciplinas', requireCoordinator, async (req, res) => {
    const data = disciplinaSchema.parse(req.body);
    const actor = res.locals.actor as Actor;
    const disciplina = await prisma.disciplina.create({ data: { ...data, instituicaoId: actor.instituicaoId } });
    res.status(201).json({ disciplina });
  });
  router.get('/disciplinas', requireCoordinator, async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const disciplinas = await prisma.disciplina.findMany({ where: { instituicaoId: actor.instituicaoId }, orderBy: [{ codigo: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
    res.json({ disciplinas, pagina, porPagina: 50 });
  });
  router.post('/campos-estagio', requireCoordinator, async (req, res) => {
    const data = campoSchema.parse(req.body);
    const actor = res.locals.actor as Actor;
    const campoEstagio = await prisma.campoEstagio.create({ data: { ...data, instituicaoId: actor.instituicaoId } });
    res.status(201).json({ campoEstagio });
  });
  router.get('/campos-estagio', requireCoordinator, async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const camposEstagio = await prisma.campoEstagio.findMany({ where: { instituicaoId: actor.instituicaoId }, orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
    res.json({ camposEstagio, pagina, porPagina: 50 });
  });

  router.put('/alunos/:id/turma', requireCoordinator, async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const { turmaId } = matriculaSchema.parse(req.body);
    const result = await setStudentClass(res.locals.actor as Actor, id, turmaId);
    res.status(result.criada ? 201 : 200).json(result);
  });
  router.post('/alunos/:id/turma/encerrar', requireCoordinator, async (req, res) => {
    await closeStudentClass(res.locals.actor as Actor, userIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  router.get('/alunos/:id/matriculas', requireCoordinator, async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const student = await prisma.usuario.findFirst({ where: { id, instituicaoId: actor.instituicaoId, perfil: 'aluno' }, select: { id: true } });
    if (!student) throw new HttpError(404, 'Aluno não encontrado.');
    const matriculas = await prisma.matriculaTurma.findMany({
      where: { alunoId: id, instituicaoId: actor.instituicaoId },
      include: { turma: { select: { id: true, codigo: true } } },
      orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50,
    });
    res.json({ matriculas, pagina, porPagina: 50 });
  });

  router.post('/estagios', requireCoordinator, async (req, res) => {
    const stage = await createStage(res.locals.actor as Actor, estagioSchema.parse(req.body));
    res.status(201).json({ estagio: stage });
  });
  router.get('/estagios', async (req, res) => {
    const { pagina } = listSchema.parse(req.query);
    const estagios = await prisma.estagio.findMany({ where: stageScope(res.locals.actor as Actor), select: stageSelect, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50 });
    res.json({ estagios, pagina, porPagina: 50 });
  });
  router.get('/estagios/:id', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const estagio = await prisma.estagio.findFirst({ where: { ...stageScope(res.locals.actor as Actor), id }, select: stageSelect });
    if (!estagio) throw new HttpError(404, 'Grupo de estágio não encontrado.');
    res.json({ estagio });
  });
  router.get('/estagios/:id/alunos', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const { pagina } = listSchema.parse(req.query);
    const actor = res.locals.actor as Actor;
    const group = await prisma.estagio.findFirst({ where: { ...stageScope(actor), id }, select: { id: true } });
    if (!group) throw new HttpError(404, 'Grupo de estágio não encontrado.');
    const vinculos = await prisma.vinculoEstagio.findMany({
      where: { estagioId: id, instituicaoId: actor.instituicaoId, ...(actor.perfil === 'aluno' ? { alunoId: actor.id } : {}) },
      select: { id: true, iniciadoEm: true, encerradoEm: true, matricula: { select: { aluno: { select: { id: true, nome: true, ativo: true } } } } },
      orderBy: [{ iniciadoEm: 'desc' }, { id: 'asc' }], take: 50, skip: (pagina - 1) * 50,
    });
    res.json({ vinculos, pagina, porPagina: 50 });
  });
  router.post('/estagios/:id/alunos', requireCoordinator, async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    const { alunoId } = alunoSchema.parse(req.body);
    const result = await assignStudent(res.locals.actor as Actor, id, alunoId);
    res.status(result.criado ? 201 : 200).json(result);
  });
  router.post('/estagios/:id/alunos/:alunoId/encerrar', requireCoordinator, async (req, res) => {
    await closeStudentStage(res.locals.actor as Actor, userIdSchema.parse(req.params.id), userIdSchema.parse(req.params.alunoId));
    res.status(204).end();
  });
  router.post('/estagios/:id/encerrar', requireCoordinator, async (req, res) => {
    await closeStage(res.locals.actor as Actor, userIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  return router;
}
