import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { LIBRARY_STATUSES } from '../db/database.js';
import { createLibraryController } from '../controllers/library.controller.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimitOptions, type RateLimitSettings } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import type { LibraryService } from '../services/library.service.js';
import { commaSeparatedList, lang, MULTI_VALUE, workParams } from './work.routes.js';

/** Plus de chapitres qu'aucune œuvre n'en compte : borne la saisie, sans règle métier. */
const MAX_COUNT = 99_999;

const counter = z.number().int().min(0).max(MAX_COUNT);

export const entryBody = z.strictObject({
  status: z.enum(LIBRARY_STATUSES).describe('Statut de lecture.'),
  chaptersRead: counter
    .describe('Chapitres lus, indépendants des tomes ; omis : inchangé (0 à la création).')
    .optional(),
  volumesRead: counter
    .describe('Tomes lus, indépendants des chapitres ; omis : inchangé (0 à la création).')
    .optional(),
  rating: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .describe('Note de 1 à 10 ; `null` la retire, omise : inchangée.')
    .optional(),
  startedOn: z.iso
    .date()
    .nullable()
    .describe(
      'Date de début `YYYY-MM-DD`. Proposée (aujourd’hui) au passage à `reading` si absente.',
    )
    .optional(),
  finishedOn: z.iso
    .date()
    .nullable()
    .describe(
      'Date de fin `YYYY-MM-DD`. Proposée (aujourd’hui) au passage à `completed` si absente.',
    )
    .optional(),
});

export const listEntriesQuery = z.object({
  q: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe('Mots recherchés (6 au plus) dans les œuvres de la liste, comme `GET /works`.')
    .optional(),
  status: commaSeparatedList(z.enum(LIBRARY_STATUSES))
    .describe(`Statuts de lecture (OU). ${MULTI_VALUE}`)
    .optional(),
  lang: lang.optional(),
  sort: z
    .enum(['updated', 'title', 'rating'])
    .describe('Ordre : dernière progression, titre A→Z, mieux notées d’abord.')
    .default('updated'),
  page: z.coerce.number().int().min(1).max(100_000).describe('Numéro de page.').default(1),
  pageSize: z.coerce.number().int().min(1).max(50).describe('Œuvres par page.').default(50),
});

/** Monté sous `/me` : la liste de lecture de l'utilisateur connecté. */
export function createMyLibraryRouter(service: LibraryService): Router {
  const controller = createLibraryController(service);
  const router = Router();
  router.get('/entries', requireUser, validate('query', listEntriesQuery), controller.list);
  return router;
}

/** Monté sous `/works` : le suivi d'une œuvre par l'utilisateur connecté. */
export function createLibraryRouter(
  service: LibraryService,
  options: { rateLimit: RateLimitSettings },
): Router {
  const limiter = rateLimit(rateLimitOptions(options.rateLimit));
  const controller = createLibraryController(service);
  const router = Router();
  router.get('/:id/entry', requireUser, validate('params', workParams), controller.get);
  router.put(
    '/:id/entry',
    requireUser,
    limiter,
    validate('params', workParams),
    validate('body', entryBody),
    controller.save,
  );
  router.delete(
    '/:id/entry',
    requireUser,
    limiter,
    validate('params', workParams),
    controller.remove,
  );
  return router;
}
