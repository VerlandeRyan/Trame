import { Router } from 'express';
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../config.js';
import { createWorkController } from '../controllers/work.controller.js';
import { WORK_STATUSES, WORK_TYPES } from '../domain/catalogue-enums.js';
import { validate } from '../middleware/validate.js';
import {
  commaSeparatedList,
  genreCode,
  idParams,
  MULTI_VALUE,
  pageQuery,
} from '../schemas/common.js';
import type { WorkService } from '../services/work.service.js';

/** Langue de l'application ; absente, titres et synopsis sont renvoyés dans la langue originale. */
export const lang = z
  .enum(SUPPORTED_LANGUAGES)
  .describe('Langue de l’application ; absente, titres et synopsis sont dans la langue originale.');

/** Recherche et filtres, communs à la liste et aux compteurs. Les `describe` alimentent OpenAPI. */
const filtersQuery = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe('Mots recherchés (6 au plus) dans le titre, les auteurs, les éditeurs et les genres.')
    .optional(),
  type: commaSeparatedList(z.enum(WORK_TYPES))
    .describe(`Types d'œuvre (OU). ${MULTI_VALUE}`)
    .optional(),
  status: commaSeparatedList(z.enum(WORK_STATUSES))
    .describe(`Statuts de publication (OU). ${MULTI_VALUE}`)
    .optional(),
  format: commaSeparatedList(genreCode)
    .describe(`Codes de format, ex. manga (OU). ${MULTI_VALUE}`)
    .optional(),
  genre: commaSeparatedList(genreCode)
    .describe(`Codes de genre, ex. fantasy (ET : l'œuvre doit les avoir tous). ${MULTI_VALUE}`)
    .optional(),
  originalLanguage: commaSeparatedList(z.string().regex(/^[a-z]{2,3}$/))
    .describe(`Langues originales, codes ISO 639 (OU). ${MULTI_VALUE}`)
    .optional(),
});

export const listWorksQuery = filtersQuery.extend({
  lang: lang.optional(),
  sort: z
    .enum(['relevance', 'title', 'recent'])
    .describe('Ordre : pertinence (titre sans `q`), titre A→Z, dernières ajoutées au catalogue.')
    .default('relevance'),
  ...pageQuery('Œuvres'),
});

/** `match=any` : les compteurs suivent une liste passée aux résultats approchants. */
export const facetsQuery = filtersQuery.extend({ match: z.enum(['all', 'any']).optional() });

export const workQuery = z.object({ lang: lang.optional() });

export function createWorkRouter(service: WorkService): Router {
  const router = Router();
  const controller = createWorkController(service);
  router.get('/', validate('query', listWorksQuery), controller.list);
  // Avant `/:id`, sinon « facets » serait lu comme un identifiant.
  router.get('/facets', validate('query', facetsQuery), controller.facets);
  router.get('/featured', validate('query', workQuery), controller.listFeaturedWorks);
  router.get('/top-rated', validate('query', workQuery), controller.listTopRatedWorks);
  router.get('/:id', validate('params', idParams), validate('query', workQuery), controller.get);
  return router;
}
