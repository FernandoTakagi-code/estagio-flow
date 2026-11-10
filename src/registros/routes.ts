import { Router } from 'express';
import * as controller from './controller.js';

export function createRecordsRouter() {
  const router = Router();
  router.get('/painel', controller.panel);
  router.post('/registros/aprovar', controller.approve);
  router.post('/registros/:id/reabrir', controller.reopen);
  router.get('/registros/:id/aprovacoes', controller.approvals);
  router.get('/alunos/:id/horas', controller.hours);
  router.get('/fichas', controller.sheets);
  router.get('/fichas/:id', controller.sheet);
  router.post('/fichas/:id/fechar', controller.closeSheet);
  router.post('/registros', controller.create);
  router.get('/registros', controller.list);
  router.get('/registros/:id', controller.find);
  router.get('/registros/:id/historico', controller.history);
  router.put('/registros/:id', controller.edit);
  router.post('/registros/:id/enviar', controller.send);
  router.post('/registros/:id/devolver', controller.returnRecord);
  router.post('/registros/:id/cancelar', controller.cancel);
  return router;
}
