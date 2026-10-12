import { Router } from 'express';
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../config.js';
import { createWorkController } from '../controllers/work.controller.js';
import { validate } from '../middleware/validate.js';
import type { WorkService } from '../services/work.service.js';

/** Code de genre ou de format : slug en minuscules. */
const genreCode = z
  .string()
  .trim()
  .max(50)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

/** Langue de l'application ; absente, titres et synopsis sont renvoyés dans la langue originale. */
const lang = z.enum(SUPPORTED_LANGUAGES);

const listWorksQuery = z.object({
  lang: lang.optional(),
  q: z.string().trim().min(2).max(100).optional(),
  type: z.enum(['series', 'oneshot', 'anthology']).optional(),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned']).optional(),
  format: genreCode.optional(),
  genre: genreCode.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const workQuery = z.object({ lang: lang.optional() });

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
  router.get('/:id', validate('params', workParams), validate('query', workQuery), controller.get);
  return router;
}
