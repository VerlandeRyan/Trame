import { Router } from 'express';
import { z } from 'zod';
import { createWorkController } from '../controllers/work.controller.js';
import { validate } from '../middleware/validate.js';
import type { WorkService } from '../services/work.service.js';

const listWorksQuery = z.object({
  q: z.string().trim().min(2).max(100).optional(),
  type: z.enum(['series', 'oneshot', 'webcomic', 'collection']).optional(),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned']).optional(),
  genre: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const workParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d{0,14}$/)
    .transform(Number),
});

export function createWorkRouter(service: WorkService): Router {
  const router = Router();
  const controller = createWorkController(service);
  router.get('/', validate('query', listWorksQuery), controller.list);
  router.get('/:id', validate('params', workParams), controller.get);
  return router;
}
