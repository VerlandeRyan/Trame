import { z } from 'zod';
import {
  CREDIT_ROLES,
  EXTERNAL_LINK_KINDS,
  PERSON_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_STATUSES,
  WORK_TYPES,
} from '../domain/catalogue-enums.js';
import type {
  AdminWorkListItem,
  AdminWorkRecord,
  AdminWorkSummary,
} from '../repositories/admin-work.repository.js';
import type {
  AdminPersonRecord,
  AdminPersonSummary,
} from '../repositories/admin-person.repository.js';
import type { AdminPublisherSummary } from '../repositories/admin-publisher.repository.js';
import type { Page } from '../services/admin-list.js';

// Réponses de l'administration du catalogue ; `satisfies` les lie aux types des dépôts.

const link = z.strictObject({
  kind: z.enum(EXTERNAL_LINK_KINDS),
  url: z.string(),
  label: z.string().nullable(),
});

function pageOf<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

const personSummary = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  kind: z.enum(PERSON_KINDS),
  archived: z.boolean(),
  activeWorkCount: z.number().int().describe('Œuvres non archivées où la personne est créditée.'),
}) satisfies z.ZodType<AdminPersonSummary>;

export const adminPersonSchema = personSummary.extend({
  links: z.array(link),
}) satisfies z.ZodType<AdminPersonRecord>;

export const adminPersonPageSchema = pageOf(personSummary) satisfies z.ZodType<
  Page<AdminPersonSummary>
>;

export const adminPublisherSchema = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  kind: z.enum(PUBLISHER_KINDS),
  url: z.string().nullable(),
  archived: z.boolean(),
  activeWorkCount: z.number().int().describe('Œuvres non archivées publiées.'),
}) satisfies z.ZodType<AdminPublisherSummary>;

export const adminPublisherPageSchema = pageOf(adminPublisherSchema) satisfies z.ZodType<
  Page<AdminPublisherSummary>
>;

const workSummary = z.strictObject({
  id: z.number().int(),
  title: z.string(),
  originalLanguage: z.string(),
  type: z.enum(WORK_TYPES),
  status: z.enum(WORK_STATUSES),
  archived: z.boolean(),
}) satisfies z.ZodType<AdminWorkSummary>;

export const adminWorkSchema = workSummary.extend({
  chapters: z.number().int().nullable(),
  volumes: z.number().int().nullable(),
  startedOn: z.string().nullable(),
  endedOn: z.string().nullable(),
  titles: z.array(
    z.strictObject({ language: z.string(), kind: z.enum(TITLE_KINDS), title: z.string() }),
  ),
  synopses: z.array(
    z.strictObject({ language: z.string(), text: z.string(), source: z.enum(SYNOPSIS_SOURCES) }),
  ),
  credits: z.array(z.strictObject({ personId: z.number().int(), role: z.enum(CREDIT_ROLES) })),
  publisherIds: z.array(z.number().int()),
  genres: z.array(z.string()).describe('Codes de format et de genre.'),
  relations: z.array(
    z.strictObject({ relatedWorkId: z.number().int(), relation: z.enum(RELATION_KINDS) }),
  ),
  links: z.array(link),
  followerCount: z.number().int().describe('Membres qui ont l’œuvre dans leur liste de lecture.'),
  updatedAt: z.iso
    .datetime()
    .describe('Version de la fiche, à renvoyer avec le remplacement (`PUT`).'),
}) satisfies z.ZodType<AdminWorkRecord>;

const workListItem = workSummary.extend({
  formats: z.array(z.string()).describe('Codes de format, triés.'),
  mainAuthor: z.string().nullable(),
  updatedAt: z.iso.datetime().describe('Dernière modification.'),
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: z.string().nullable().describe('Pseudo de l’administrateur qui a archivé.'),
  completeness: z
    .number()
    .int()
    .describe('0 à 100, par quarts : synopsis, éditeur, lien, couverture.'),
}) satisfies z.ZodType<AdminWorkListItem>;

export const adminWorkPageSchema = pageOf(workListItem) satisfies z.ZodType<
  Page<AdminWorkListItem>
>;
