import { Router } from 'express';
import { requireCoordinator } from '../auth/middleware.js';
import * as controller from './controller.js';

export function createAcademicRouter() {
  const router = Router();
  router.get('/matriculas', requireCoordinator, controller.listEnrollments);
  router.get('/meus-vinculos', controller.listStudentLinks);
  router.post('/turmas', requireCoordinator, controller.createClass);
  router.get('/turmas', requireCoordinator, controller.listClasses);
  router.post('/disciplinas', requireCoordinator, controller.createDiscipline);
  router.get('/disciplinas', requireCoordinator, controller.listDisciplines);
  router.post('/campos-estagio', requireCoordinator, controller.createField);
  router.get('/campos-estagio', requireCoordinator, controller.listFields);
  router.put('/alunos/:id/turma', requireCoordinator, controller.enroll);
  router.post('/alunos/:id/turma/encerrar', requireCoordinator, controller.closeEnrollment);
  router.get('/alunos/:id/matriculas', requireCoordinator, controller.studentEnrollments);
  router.post('/estagios', requireCoordinator, controller.createGroup);
  router.get('/estagios', controller.listGroups);
  router.get('/estagios/:id', controller.findGroup);
  router.get('/estagios/:id/alunos-elegiveis', requireCoordinator, controller.eligible);
  router.get('/estagios/:id/alunos', controller.listMembers);
  router.post('/estagios/:id/alunos', requireCoordinator, controller.assign);
  router.post('/estagios/:id/alunos/:alunoId/encerrar', requireCoordinator, controller.closeLink);
  router.post('/estagios/:id/encerrar', requireCoordinator, controller.closeGroup);
  return router;
}
