import { z } from 'zod';
import { LIBRARY_STATUSES } from '../domain/user-enums.js';
import type { EntryInput, ListEntriesInput } from '../services/library.service.js';
import { commaSeparatedList, lang, MULTI_VALUE, pageQuery } from './common.js';

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
}) satisfies z.ZodType<EntryInput>;

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
  ...pageQuery('Œuvres', 50),
}) satisfies z.ZodType<ListEntriesInput>;
