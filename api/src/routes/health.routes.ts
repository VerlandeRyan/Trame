/** Route of the health probe. */
import { Router } from 'express';
import type { HealthService } from '../services/health.service.js';
import { createHealthController } from '../controllers/health.controller.js';

/** Builds the health router. */
export function createHealthRouter(service: HealthService): Router {
  const router = Router();
  router.get('/', createHealthController(service).get);
  return router;
}
