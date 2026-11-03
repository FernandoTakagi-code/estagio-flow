import { Router } from 'express';
import * as controller from './controller.js';
export function createAgendaRouter() {
  const router = Router();
  router.get('/sessoes', controller.list);
  router.post('/sessoes', controller.create);
  router.get('/sessoes/:id', controller.detail);
  router.put('/sessoes/:id', controller.edit);
  router.post('/sessoes/:id/cancelar', controller.cancel);
  router.put('/sessoes/:id/frequencia', controller.mark);
  router.put('/sessoes/:id/chamada', controller.markBatch);
  router.get('/sessoes/:id/historico', controller.history);
  return router;
}
