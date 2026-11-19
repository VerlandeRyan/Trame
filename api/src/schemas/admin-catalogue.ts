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
import { ARCHIVE_SCOPES, PUBLICATION_STATES } from '../repositories/admin-sql.js';
import type { AdminListInput } from '../services/admin-list.js';
import {
  ADMIN_WORK_SORTS,
  type AdminWorkInput,
  type AdminWorkListInput,
  type AdminWorkReplacement,
} from '../services/admin-work.service.js';
import type { AdminPersonInput, AdminPersonReplacement } from '../services/admin-person.service.js';
import type {
  AdminPublisherInput,
  AdminPublisherReplacement,
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

/** Whether a new record is published at creation (otherwise a draft); ignored when replacing. */
const published = z
  .boolean()
  .describe('À la création : publiée (défaut) ou en brouillon. Ignoré au remplacement.')
  .default(true);

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

/** Query of the administration lists: search text, archive scope and pagination. */
export const adminListQuery = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe('Texte cherché dans le nom ou le titre, sans tenir compte des accents.')
    .optional(),
  scope: z
    .enum(ARCHIVE_SCOPES)
    .describe('Fiches publiées, archives seules, ou les deux.')
    .default('active'),
  state: z
    .enum(PUBLICATION_STATES)
    .describe('Brouillons seuls, fiches publiées seules, ou les deux.')
    .default('all'),
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
  published,
};

/** Body to create a person. */
export const personBody = z.strictObject(personFields) satisfies z.ZodType<AdminPersonInput>;

/** Body to replace a person: the creation body and the version that was read. */
export const personReplaceBody = z.strictObject({
  ...personFields,
  updatedAt: recordVersion,
}) satisfies z.ZodType<AdminPersonReplacement>;

const publisherFields = {
  name,
  kind: z.enum(PUBLISHER_KINDS),
  url: httpsUrl.nullable().default(null),
  published,
};

/** Body to create a publisher. */
export const publisherBody = z.strictObject(
  publisherFields,
) satisfies z.ZodType<AdminPublisherInput>;

/** Body to replace a publisher: the creation body and the version that was read. */
export const publisherReplaceBody = z.strictObject({
  ...publisherFields,
  updatedAt: recordVersion,
}) satisfies z.ZodType<AdminPublisherReplacement>;

/** A validation problem attached to a field of the work body. */
type KeyedIssue = { path: string; message: string };

/** Whether two items of the list share the same key. */
function hasDuplicate<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size !== items.length;
}

/** Reports every list of the work that contains duplicate entries. */
function duplicateIssues(work: AdminWorkInput): KeyedIssue[] {
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
function ruleIssues(work: AdminWorkInput): KeyedIssue[] {
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
  published,
};

/** Reports the business rules a work body breaks as issues on their field. */
function checkWorkRules(work: AdminWorkInput, ctx: z.RefinementCtx): void {
  for (const { path, message } of ruleIssues(work)) {
    ctx.addIssue({ code: 'custom', path: [path], message });
  }
}

/** Body to create a work, with its titles, credits, genres, relations and links. */
export const workBody = z
  .strictObject(workFields)
  .superRefine(checkWorkRules) satisfies z.ZodType<AdminWorkInput>;

/** Body to replace a work: the creation body and the version that was read. */
export const workReplaceBody = z
  .strictObject({ ...workFields, updatedAt: recordVersion })
  .superRefine(checkWorkRules) satisfies z.ZodType<AdminWorkReplacement>;
