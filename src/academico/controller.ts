import type { Request, Response } from 'express';
import { userIdSchema, listSchema } from '../auth/schemas.js';
import type { Actor } from '../auth/user-select.js';
import { turmaSchema, disciplinaSchema, campoSchema, matriculaSchema, alunoSchema, estagioSchema, eligibleQuerySchema } from './schemas.js';
import * as service from './service.js';
import * as queries from './query-service.js';

const actor = (res: Response) => res.locals.actor as Actor;
const page = (req: Request) => listSchema.parse(req.query).pagina;
const id = (req: Request) => userIdSchema.parse(req.params.id);
export async function listEnrollments(req: Request, res: Response) { const pagina = page(req); res.json({ matriculas: await queries.listEnrollments(actor(res).instituicaoId, pagina), pagina, porPagina: 50 }); }
export async function listStudentLinks(req: Request, res: Response) { const pagina = page(req); res.json({ vinculos: await queries.listStudentLinks(actor(res), pagina), pagina, porPagina: 50 }); }
export async function createClass(req: Request, res: Response) { res.status(201).json({ turma: await queries.createClass(actor(res).instituicaoId, turmaSchema.parse(req.body).codigo) }); }
export async function createDiscipline(req: Request, res: Response) { res.status(201).json({ disciplina: await queries.createDiscipline(actor(res).instituicaoId, disciplinaSchema.parse(req.body)) }); }
export async function createField(req: Request, res: Response) { res.status(201).json({ campoEstagio: await queries.createField(actor(res).instituicaoId, campoSchema.parse(req.body).nome) }); }
export async function listClasses(req: Request, res: Response) { const pagina = page(req); res.json({ turmas: await queries.listClasses(actor(res).instituicaoId, pagina), pagina, porPagina: 50 }); }
export async function listDisciplines(req: Request, res: Response) { const pagina = page(req); res.json({ disciplinas: await queries.listDisciplines(actor(res).instituicaoId, pagina), pagina, porPagina: 50 }); }
export async function listFields(req: Request, res: Response) { const pagina = page(req); res.json({ camposEstagio: await queries.listFields(actor(res).instituicaoId, pagina), pagina, porPagina: 50 }); }
export async function enroll(req: Request, res: Response) { const result = await service.setStudentClass(actor(res), id(req), matriculaSchema.parse(req.body).turmaId); res.status(result.criada ? 201 : 200).json(result); }
export async function closeEnrollment(req: Request, res: Response) { await service.closeStudentClass(actor(res), id(req)); res.status(204).end(); }
export async function studentEnrollments(req: Request, res: Response) { const pagina = page(req); res.json({ matriculas: await queries.studentEnrollments(actor(res), id(req), pagina), pagina, porPagina: 50 }); }
export async function createGroup(req: Request, res: Response) { res.status(201).json({ estagio: await service.createStage(actor(res), estagioSchema.parse(req.body)) }); }
export async function listGroups(req: Request, res: Response) { const pagina = page(req); res.json({ estagios: await queries.listGroups(actor(res), pagina), pagina, porPagina: 50 }); }
export async function findGroup(req: Request, res: Response) { res.json({ estagio: await queries.findGroup(actor(res), id(req)) }); }
export async function listMembers(req: Request, res: Response) { const pagina = page(req); res.json({ vinculos: await queries.listMembers(actor(res), id(req), pagina), pagina, porPagina: 50 }); }
export async function assign(req: Request, res: Response) { const result = await service.assignStudent(actor(res), id(req), alunoSchema.parse(req.body).alunoId); res.status(result.criado ? 201 : 200).json(result); }
export async function closeLink(req: Request, res: Response) { await service.closeStudentStage(actor(res), id(req), userIdSchema.parse(req.params.alunoId)); res.status(204).end(); }
export async function closeGroup(req: Request, res: Response) { await service.closeStage(actor(res), id(req)); res.status(204).end(); }
export async function eligible(req: Request, res: Response) { const { pagina, busca } = eligibleQuerySchema.parse(req.query); const alunos = await queries.eligibleStudents(actor(res), id(req), pagina, busca); res.json({ alunos, pagina, porPagina: 50 }); }
