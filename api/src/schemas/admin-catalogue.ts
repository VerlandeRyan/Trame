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
import { ARCHIVE_SCOPES } from '../repositories/admin-sql.js';
import type { AdminListInput } from '../services/admin-list.js';
import {
  ADMIN_WORK_SORTS,
  type AdminWorkInput,
  type AdminWorkListInput,
} from '../services/admin-work.service.js';
import type { AdminPersonInput } from '../services/admin-person.service.js';
import type { AdminPublisherInput } from '../services/admin-publisher.service.js';
import { commaSeparatedList, genreCode, pageQuery } from './common.js';

const name = z.string().trim().min(1).max(200);
const language = z
  .string()
  .regex(/^[a-z]{2,3}$/)
  .describe('Code ISO 639, en minuscules.');
const httpsUrl = z.url({ protocol: /^https$/ }).max(2000);
const positiveId = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const counter = z.number().int().min(0).max(99_999);

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
  ...pageQuery('Éléments'),
}) satisfies z.ZodType<AdminListInput>;

/** Liste des œuvres : mêmes paramètres, plus tri et filtres (valeurs d'un filtre : OU ; filtres entre eux : ET). */
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

export const personBody = z.strictObject({
  name,
  kind: z.enum(PERSON_KINDS),
  links: personLinks.default([]),
}) satisfies z.ZodType<AdminPersonInput>;

export const publisherBody = z.strictObject({
  name,
  kind: z.enum(PUBLISHER_KINDS),
  url: httpsUrl.nullable().default(null),
}) satisfies z.ZodType<AdminPublisherInput>;

type KeyedIssue = { path: string; message: string };

/** Vrai si deux éléments de la liste ont la même clé. */
function hasDuplicate<T>(items: T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size !== items.length;
}

function duplicateIssues(work: AdminWorkInput): KeyedIssue[] {
  const checks: [string, boolean][] = [
    ['titles', hasDuplicate(work.titles, (t) => `${t.language}|${t.title}`)],
    ['synopses', hasDuplicate(work.synopses, (s) => s.language)],
    ['credits', hasDuplicate(work.credits, (c) => `${c.personId}|${c.role}`)],
    ['publisherIds', hasDuplicate(work.publisherIds, String)],
    ['genres', hasDuplicate(work.genres, (code) => code)],
    // RG-17 : une seule relation principale par œuvre liée.
    ['relations', hasDuplicate(work.relations, (r) => String(r.relatedWorkId))],
  ];
  return checks
    .filter(([, duplicated]) => duplicated)
    .map(([path]) => ({ path, message: 'Duplicate entries.' }));
}

function ruleIssues(work: AdminWorkInput): KeyedIssue[] {
  const issues = duplicateIssues(work);
  // RG-18 : tant que l'œuvre est en cours, les totaux restent vides.
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

export const workBody = z
  .strictObject({
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
    genres: z.array(genreCode).max(30).default([]).describe('Codes de format et de genre.'),
    relations: z
      .array(z.strictObject({ relatedWorkId: positiveId, relation: z.enum(RELATION_KINDS) }))
      .max(50)
      .default([]),
    links: workLinks.default([]),
    updatedAt: z.iso
      .datetime()
      .describe(
        'Version de la fiche (`updatedAt` lu avant modification) : refusé en 409 si la fiche a changé depuis. Ignoré à la création.',
      )
      .optional(),
  })
  .superRefine((work, ctx) => {
    for (const { path, message } of ruleIssues(work)) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  }) satisfies z.ZodType<AdminWorkInput>;
