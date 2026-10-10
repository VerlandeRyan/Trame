import { Router } from 'express';
import type { WorkService } from '../services/work.service.js';
import { createWorkRouter } from './work.routes.js';

export interface ApiServices {
  workService: WorkService;
}

/** Routes versionnées, montées sous `/api/v1`. Les routes métier s'ajoutent ici. */
export function createApiRouter({ workService }: ApiServices): Router {
  const router = Router();
  router.use('/works', createWorkRouter(workService));
  return router;
}
