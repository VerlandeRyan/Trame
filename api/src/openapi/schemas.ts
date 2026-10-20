import { z } from 'zod';
import { ERROR_CODES, type ErrorBody } from '../errors.js';
import type { GenreRecord } from '../repositories/genre.repository.js';
import type { FeaturedWork, WorkFacets, WorkSummary } from '../repositories/work.repository.js';
import type { AuthStatus } from '../services/auth.service.js';
import type { HealthStatus } from '../services/health.service.js';
import type { TopRatedWork, WorkDetail, WorkPage } from '../services/work.service.js';

// `satisfies` lie chaque schéma au type du service ; `strictObject` fait échouer le test de contrat
// si une réponse gagne un champ non décrit.

const workType = z.enum(['series', 'oneshot', 'anthology']);
const workStatus = z.enum(['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned']);
const externalLinkKind = z.enum(['read', 'buy', 'website', 'social']);
const personKind = z.enum(['person', 'collective']);
const publisherKind = z.enum(['publisher', 'platform', 'self_published']);
const creditRole = z.enum(['story', 'art', 'colors', 'other']);
const titleKind = z.enum(['translated', 'international', 'former', 'short']);
const relationKind = z.enum([
  'sequel',
  'prequel',
  'spin_off',
  'side_story',
  'adaptation',
  'alternate_version',
  'shared_universe',
  'contains',
  'other',
]);

const workSummary = z.strictObject({
  id: z.number().int(),
  title: z.string().describe('Titre dans la langue demandée, sinon titre original.'),
  originalTitle: z.string(),
  originalLanguage: z.string().describe('Code ISO 639.'),
  type: workType,
  status: workStatus,
  formats: z.array(z.string()).describe('Codes des formats, triés.'),
  coverPath: z.string().nullable(),
  mainAuthor: z.string().nullable(),
}) satisfies z.ZodType<WorkSummary>;

export const workPageSchema = z.strictObject({
  items: z.array(workSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int().describe('Nombre total d’œuvres correspondant à la recherche.'),
  approximate: z
    .boolean()
    .describe('Aucune œuvre ne contient tous les mots : la liste donne celles qui en ont un.'),
}) satisfies z.ZodType<WorkPage>;

const facetCounts = z.array(z.strictObject({ code: z.string(), count: z.number().int() }));

export const workFacetsSchema = z
  .strictObject({
    type: facetCounts,
    status: facetCounts,
    format: facetCounts,
    genre: facetCounts,
    originalLanguage: facetCounts,
  })
  .describe(
    'Œuvres par valeur de filtre ; chaque groupe ignore son propre filtre (sauf `genre`, en ET).',
  ) satisfies z.ZodType<WorkFacets>;

export const featuredListSchema = z
  .strictObject({
    items: z.array(
      workSummary.extend({
        synopsis: z
          .string()
          .nullable()
          .describe('Synopsis dans la langue demandée, sinon dans la langue originale.'),
        recentAdditions: z
          .number()
          .int()
          .describe(
            'Ajouts à une liste depuis 7 jours (au moins 3), pour « N lecteurs l’ont ajoutée ».',
          ),
      }) satisfies z.ZodType<FeaturedWork>,
    ),
  })
  .describe('Jusqu’à 3 œuvres, la plus ajoutée à une liste récemment d’abord ; vide si aucune.');

export const topRatedListSchema = z
  .strictObject({
    items: z.array(
      workSummary.extend({
        ratingCount: z.number().int(),
        ratingAverage: z.number().describe('Moyenne sur une décimale.'),
      }) satisfies z.ZodType<TopRatedWork>,
    ),
  })
  .describe(
    'Jusqu’à 12 œuvres ayant au moins 10 notes, les mieux notées d’abord ; vide si aucune.',
  );

const link = z.strictObject({
  kind: externalLinkKind,
  url: z.string(),
  label: z.string().nullable(),
});

export const workDetailSchema = z.strictObject({
  id: z.number().int(),
  title: z.string(),
  originalTitle: z.string(),
  originalLanguage: z.string(),
  type: workType,
  status: workStatus,
  synopsis: z.string().nullable(),
  synopsisLanguage: z.string().nullable(),
  synopsisSource: z.enum(['official', 'human', 'machine']).nullable(),
  chapters: z.number().int().nullable(),
  volumes: z.number().int().nullable(),
  startedOn: z.string().nullable().describe('Date ISO.'),
  endedOn: z.string().nullable().describe('Date ISO.'),
  coverPath: z.string().nullable(),
  alternativeTitles: z.array(
    z.strictObject({ language: z.string(), kind: titleKind, title: z.string() }),
  ),
  credits: z
    .array(
      z.strictObject({
        personId: z.number().int(),
        name: z.string(),
        kind: personKind,
        roles: z.array(creditRole),
        links: z.array(link),
      }),
    )
    .describe('Une entrée par personne, avec l’ensemble de ses rôles.'),
  publishers: z.array(
    z.strictObject({
      id: z.number().int(),
      name: z.string(),
      kind: publisherKind,
      url: z.string().nullable(),
    }),
  ),
  formats: z.array(z.string()),
  genres: z.array(z.string()),
  links: z.array(link),
  relations: z.array(
    z.strictObject({
      relation: relationKind,
      direction: z
        .enum(['outgoing', 'incoming'])
        .describe('`outgoing` : cette œuvre est la source ; `incoming` : elle est la cible.'),
      work: z.strictObject({ id: z.number().int(), title: z.string(), type: workType }),
    }),
  ),
  memberCount: z.number().int().describe('Lecteurs qui ont l’œuvre dans leur liste.'),
  ratingCount: z.number().int(),
  ratingAverage: z
    .number()
    .nullable()
    .describe('Moyenne sur une décimale ; `null` sous 10 notes (RG-04).'),
}) satisfies z.ZodType<WorkDetail>;

export const genreListSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      code: z.string(),
      category: z.enum(['format', 'theme']),
    }) satisfies z.ZodType<GenreRecord>,
  ),
});

export const healthSchema = z.strictObject({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['up', 'down']),
}) satisfies z.ZodType<HealthStatus>;

export const authStatusSchema = z
  .discriminatedUnion('status', [
    z.strictObject({ status: z.literal('anonymous') }),
    z
      .strictObject({
        status: z.literal('pending'),
      })
      .describe('Identité Google validée : le handle reste à choisir (10 minutes).'),
    z.strictObject({
      status: z.literal('authenticated'),
      user: z.strictObject({
        id: z.number().int(),
        handle: z.string().describe('Pseudo public, avec la casse choisie.'),
        role: z.enum(['user', 'admin']),
      }),
    }),
  ])
  .describe(
    'Qui est derrière la requête. Jamais l’e-mail ni l’identifiant Google.',
  ) satisfies z.ZodType<AuthStatus>;

const errorCodes = Object.keys(ERROR_CODES) as [
  keyof typeof ERROR_CODES,
  ...(keyof typeof ERROR_CODES)[],
];

export const errorSchema = z
  .strictObject({
    code: z.enum(errorCodes).describe('Code stable : le front traduit à partir de lui.'),
    message: z.string().describe('Texte technique en anglais, non affiché.'),
    details: z
      .array(z.looseObject({ path: z.array(z.union([z.string(), z.number()])), code: z.string() }))
      .optional()
      .describe(
        'Erreurs de champ d’une validation : chemin, code Zod et paramètres, sans valeur saisie.',
      ),
  })
  .describe('Réponse d’erreur unique.') satisfies z.ZodType<
  Omit<ErrorBody, 'details'> & { details?: unknown }
>;
