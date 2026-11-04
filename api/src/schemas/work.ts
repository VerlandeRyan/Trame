import { z } from 'zod';
import { WORK_STATUSES, WORK_TYPES } from '../domain/catalogue-enums.js';
import type { ListWorksInput, WorkFilterInput } from '../services/work.service.js';
import { commaSeparatedList, genreCode, lang, MULTI_VALUE, pageQuery } from './common.js';

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
}) satisfies z.ZodType<ListWorksInput>;

/** `match=any` : les compteurs suivent une liste passée aux résultats approchants. */
export const facetsQuery = filtersQuery.extend({
  match: z.enum(['all', 'any']).optional(),
}) satisfies z.ZodType<WorkFilterInput>;

export const workQuery = z.object({ lang: lang.optional() });
