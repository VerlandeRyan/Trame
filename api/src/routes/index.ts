import { Router } from 'express';

/** Routes versionnées, montées sous `/api/v1`. Les routes métier s'ajoutent ici. */
export function createApiRouter(): Router {
  return Router();
}
