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

/** Nombre maximal de valeurs d'un même filtre. */
const MAX_FILTER_VALUES = 10;

/** Liste séparée par des virgules (`status=ongoing,hiatus`), chaque valeur validée, sans doublon. */
function commaSeparatedList<T extends z.ZodType<string, string>>(item: T) {
  return z
    .string()
    .transform((value) => [...new Set(value.split(',').map((part) => part.trim()))])
    .pipe(z.array(item).min(1).max(MAX_FILTER_VALUES));
}

/** Recherche et filtres, communs à la liste et aux compteurs. */
const filtersQuery = z.object({
  q: z.string().trim().min(2).max(100).optional(),
  type: commaSeparatedList(z.enum(['series', 'oneshot', 'anthology'])).optional(),
  status: commaSeparatedList(
    z.enum(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned']),
  ).optional(),
  format: commaSeparatedList(genreCode).optional(),
  genre: commaSeparatedList(genreCode).optional(),
  /** Langue originale (code ISO 639). */
  originalLanguage: commaSeparatedList(z.string().regex(/^[a-z]{2,3}$/)).optional(),
});

const listWorksQuery = filtersQuery.extend({
  lang: lang.optional(),
  sort: z.enum(['relevance', 'title', 'recent']).default('relevance'),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** `match=any` : les compteurs suivent une liste passée aux résultats approchants. */
const facetsQuery = filtersQuery.extend({ match: z.enum(['all', 'any']).optional() });

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
  // Avant `/:id`, sinon « facets » serait lu comme un identifiant.
  router.get('/facets', validate('query', facetsQuery), controller.facets);
  router.get('/:id', validate('params', workParams), validate('query', workQuery), controller.get);
  return router;
}
