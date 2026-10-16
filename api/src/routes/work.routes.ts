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
const lang = z
  .enum(SUPPORTED_LANGUAGES)
  .describe('Langue de l’application ; absente, titres et synopsis sont dans la langue originale.');

/** Nombre maximal de valeurs d'un même filtre. */
const MAX_FILTER_VALUES = 10;

/** Liste séparée par des virgules (`status=ongoing,hiatus`), chaque valeur validée, sans doublon. */
function commaSeparatedList<T extends z.ZodType<string, string>>(item: T) {
  return z
    .string()
    .transform((value) => [...new Set(value.split(',').map((part) => part.trim()))])
    .pipe(z.array(item).min(1).max(MAX_FILTER_VALUES));
}

const MULTI_VALUE = `Liste séparée par des virgules (${MAX_FILTER_VALUES} valeurs au plus, doublons ignorés).`;

/** Recherche et filtres, communs à la liste et aux compteurs. Les `describe` alimentent OpenAPI. */
const filtersQuery = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe('Mots recherchés (6 au plus) dans le titre, les auteurs, les éditeurs et les genres.')
    .optional(),
  type: commaSeparatedList(z.enum(['series', 'oneshot', 'anthology']))
    .describe(`Types d'œuvre (OU). ${MULTI_VALUE}`)
    .optional(),
  status: commaSeparatedList(z.enum(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned']))
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
  page: z.coerce.number().int().min(1).max(100_000).describe('Numéro de page.').default(1),
  pageSize: z.coerce.number().int().min(1).max(50).describe('Œuvres par page.').default(20),
});

/** `match=any` : les compteurs suivent une liste passée aux résultats approchants. */
export const facetsQuery = filtersQuery.extend({ match: z.enum(['all', 'any']).optional() });

export const workQuery = z.object({ lang: lang.optional() });

export const workParams = z.object({
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
