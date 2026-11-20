/** Input schemas of the catalogue administration (lists, people, publishers, works). */
import { z } from 'zod';
import {
  CREDIT_ROLES,
  type ExternalLinkKind,
  PERSON_KINDS,
  PERSON_LINK_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_LINK_KINDS,
  WORK_STATUSES,
  WORK_TYPES,
} from '../domain/catalogue-enums.js';
import { LIFECYCLE_FILTERS } from '../repositories/admin-sql.js';
import type { AdminListInput } from '../services/admin-list.js';
import {
  ADMIN_WORK_SORTS,
  type AdminWorkCreateInput,
  type AdminWorkListInput,
  type AdminWorkUpdateInput,
} from '../services/admin-work.service.js';
import type {
  AdminPersonCreateInput,
  AdminPersonUpdateInput,
} from '../services/admin-person.service.js';
import type {
  AdminPublisherCreateInput,
  AdminPublisherUpdateInput,
} from '../services/admin-publisher.service.js';
import { commaSeparatedList, genreCode, pageQuery } from './common.js';

/** Name or title: trimmed, non-empty text. */
const name = z.string().trim().min(1).max(200);
/** Lowercase ISO 639 language code. */
const language = z
  .string()
  .regex(/^[a-z]{2,3}$/)
  .describe('Code ISO 639, en minuscules.');
const httpsUrl = z.url({ protocol: /^https$/ }).max(2000);
const positiveId = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
/** Chapter or volume total. */
const counter = z.number().int().min(0).max(99_999);

/** Whether a new record is published at creation (otherwise a draft). */
const published = z
  .boolean()
  .describe('À la création : publiée (défaut) ou en brouillon.')
  .default(true);

/** Publishes a draft when replacing it; no default, so a replacement that omits it keeps the draft. */
const publishOnUpdate = z
  .boolean()
  .describe(
    'Publie le brouillon dans la même écriture (mêmes contrôles qu’une publication). Absent ou `false` : le brouillon reste brouillon ; une fiche publiée le reste.',
  )
  .optional();

/** Schema of a list of external links restricted to the given kinds. */
const linksOf = (kinds: readonly [ExternalLinkKind, ...ExternalLinkKind[]]) =>
  z
    .array(
      z.strictObject({
        kind: z.enum(kinds),
        url: httpsUrl.describe('Adresse en `https://`.'),
        label: z.string().trim().min(1).max(100).nullable().default(null),
      }),
    )
    .max(20);

const workLinks = linksOf(WORK_LINK_KINDS);
const personLinks = linksOf(PERSON_LINK_KINDS);

/** Query of the administration lists: search text, lifecycle and pagination. */
export const adminListQuery = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('Texte cherché dans le nom ou le titre, sans tenir compte des accents.')
    .optional(),
  lifecycle: z
    .enum(LIFECYCLE_FILTERS)
    .describe(
      'Cycle de vie : `active` (défaut) brouillons et fiches publiées, `draft` brouillons seuls, `published` fiches publiées non archivées, `archived` archives seules.',
    )
    .default('active'),
  ...pageQuery('Éléments'),
}) satisfies z.ZodType<AdminListInput>;

/** Work list: same parameters plus sort and filters (values of one filter: OR; filters together: AND). */
export const adminWorkListQuery = adminListQuery.extend({
  sort: z
    .enum(ADMIN_WORK_SORTS)
    .describe(
      'Ordre : titre A→Z ou Z→A, complétude croissante (les moins complètes d’abord) ou décroissante.',
    )
    .default('title'),
  type: commaSeparatedList(z.enum(WORK_TYPES))
    .describe('Types d’œuvre (OU), séparés par des virgules.')
    .optional(),
  status: commaSeparatedList(z.enum(WORK_STATUSES))
    .describe('Statuts de publication (OU), séparés par des virgules.')
    .optional(),
  format: commaSeparatedList(genreCode)
    .describe('Codes de format, ex. manga (OU), séparés par des virgules.')
    .optional(),
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe(
      'Texte cherché dans le titre ou dans le nom des auteurs crédités, sans tenir compte des accents.',
    )
    .optional(),
}) satisfies z.ZodType<AdminWorkListInput>;

/** Version read before editing a record, required to replace it. */
const recordVersion = z.iso
  .datetime()
  .describe(
    'Version de la fiche (`updatedAt` lu avant modification) : refusé en 409 si la fiche a changé depuis.',
  );

const personFields = {
  name,
  kind: z.enum(PERSON_KINDS),
  links: personLinks.default([]),
};

/** Body to create a person. */
export const personBody = z.strictObject({
  ...personFields,
  published,
}) satisfies z.ZodType<AdminPersonCreateInput>;

/** Body to replace a person: the fields, the version that was read, and whether to publish a draft. */
export const personUpdateBody = z.strictObject({
  ...personFields,
  published: publishOnUpdate,
  updatedAt: recordVersion,
}) satisfies z.ZodType<AdminPersonUpdateInput>;

const publisherFields = {
  name,
  kind: z.enum(PUBLISHER_KINDS),
  url: httpsUrl.nullable().default(null),
};

/** Body to create a publisher. */
export const publisherBody = z.strictObject({
  ...publisherFields,
  published,
}) satisfies z.ZodType<AdminPublisherCreateInput>;

/** Body to replace a publisher: the fields, the version that was read, and whether to publish a draft. */
export const publisherUpdateBody = z.strictObject({
  ...publisherFields,
  published: publishOnUpdate,
  updatedAt: recordVersion,
}) satisfies z.ZodType<AdminPublisherUpdateInput>;

/** The work fields the business rules read (all but the publication flag). */
type WorkFields = Omit<AdminWorkCreateInput, 'published'>;

/** A validation problem attached to a field of the work body. */
type KeyedIssue = { path: string; message: string };

/** Whether two items of the list share the same key. */
function hasDuplicate<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size !== items.length;
}

/** Reports every list of the work that contains duplicate entries. */
function duplicateIssues(work: WorkFields): KeyedIssue[] {
  const checks: [string, boolean][] = [
    ['titles', hasDuplicate(work.titles, (t) => `${t.language}|${t.title}`)],
    ['synopses', hasDuplicate(work.synopses, (s) => s.language)],
    ['credits', hasDuplicate(work.credits, (c) => `${c.personId}|${c.role}`)],
    ['publisherIds', hasDuplicate(work.publisherIds, String)],
    ['genres', hasDuplicate(work.genres, (code) => code)],
    // A single relation per related work.
    ['relations', hasDuplicate(work.relations, (r) => String(r.relatedWorkId))],
  ];
  return checks
    .filter(([, duplicated]) => duplicated)
    .map(([path]) => ({ path, message: 'Duplicate entries.' }));
}

/** Reports the business rules a work breaks: duplicates, totals while ongoing, date order. */
function ruleIssues(work: WorkFields): KeyedIssue[] {
  const issues = duplicateIssues(work);
  // While the work is ongoing, the totals stay empty.
  if (work.status === 'ongoing' && work.chapters !== null) {
    issues.push({ path: 'chapters', message: 'Totals stay empty while ongoing.' });
  }
  if (work.status === 'ongoing' && work.volumes !== null) {
    issues.push({ path: 'volumes', message: 'Totals stay empty while ongoing.' });
  }
  if (work.startedOn !== null && work.endedOn !== null && work.endedOn < work.startedOn) {
    issues.push({ path: 'endedOn', message: 'The end date precedes the start date.' });
  }
  return issues;
}

const workFields = {
  title: name.describe('Titre dans la langue originale.'),
  originalLanguage: language,
  type: z.enum(WORK_TYPES),
  status: z.enum(WORK_STATUSES),
  chapters: counter.nullable().describe('Vide tant que l’œuvre est en cours.'),
  volumes: counter.nullable().describe('Vide tant que l’œuvre est en cours.'),
  startedOn: z.iso.date().nullable(),
  endedOn: z.iso.date().nullable(),
  titles: z
    .array(z.strictObject({ language, kind: z.enum(TITLE_KINDS), title: name }))
    .max(50)
    .default([]),
  synopses: z
    .array(
      z.strictObject({
        language,
        text: z.string().trim().min(1).max(5000),
        source: z.enum(SYNOPSIS_SOURCES),
      }),
    )
    .max(20)
    .default([]),
  credits: z
    .array(z.strictObject({ personId: positiveId, role: z.enum(CREDIT_ROLES) }))
    .max(50)
    .default([]),
  publisherIds: z.array(positiveId).max(20).default([]),
  genres: z
    .array(genreCode)
    .max(30)
    .default([])
    .describe('Codes de format et de genre ; au moins un format (`VALIDATION_ERROR` sinon).'),
  relations: z
    .array(z.strictObject({ relatedWorkId: positiveId, relation: z.enum(RELATION_KINDS) }))
    .max(50)
    .default([]),
  links: workLinks.default([]),
};

/** Reports the business rules a work body breaks as issues on their field. */
function checkWorkRules(work: WorkFields, ctx: z.RefinementCtx): void {
  for (const { path, message } of ruleIssues(work)) {
    ctx.addIssue({ code: 'custom', path: [path], message });
  }
}

/** Body to create a work, with its titles, credits, genres, relations and links. */
export const workBody = z
  .strictObject({ ...workFields, published })
  .superRefine(checkWorkRules) satisfies z.ZodType<AdminWorkCreateInput>;

/** Body to replace a work: the fields, the version that was read, and whether to publish a draft. */
export const workUpdateBody = z
  .strictObject({ ...workFields, published: publishOnUpdate, updatedAt: recordVersion })
  .superRefine(checkWorkRules) satisfies z.ZodType<AdminWorkUpdateInput>;
