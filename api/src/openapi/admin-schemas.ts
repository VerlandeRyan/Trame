/** Response schemas of the catalogue administration, tied to the repository types by `satisfies`. */
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
import type { AdminWorkListItem, AdminWorkSummary } from '../repositories/admin-work.repository.js';
import type {
  AdminPersonDetail,
  AdminPersonListItem,
} from '../repositories/admin-person.repository.js';
import type { AdminPublisherListItem } from '../repositories/admin-publisher.repository.js';
import { LIFECYCLES } from '../repositories/admin-sql.js';
import type { DraftCounts } from '../controllers/admin-draft-counts.controller.js';
import type { Page } from '../services/admin-list.js';
import { PUBLICATION_GAPS } from '../services/admin-publication.js';
import type { AdminWorkDetail } from '../services/admin-work.service.js';

/** Lifecycle of a record: a draft is only visible in the administration. */
const lifecycle = z
  .enum(LIFECYCLES)
  .describe(
    'Cycle de vie : brouillon (visible seulement dans l’administration), publiée ou archivée.',
  );

/** An external link. */
const link = z.strictObject({
  kind: z.enum(EXTERNAL_LINK_KINDS),
  url: z.string(),
  label: z.string().nullable(),
});

/** A paginated list of the given item schema. */
function pageOf<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

/** Version of a record, to send back with its replacement (`PUT`). */
const recordVersion = z.iso
  .datetime()
  .describe('Version de la fiche, à renvoyer avec le remplacement (`PUT`).');

/** Handle of the administrator who archived a record. */
const archivedByHandle = z
  .string()
  .nullable()
  .describe('Pseudo de l’administrateur qui a archivé.');

/** A person as listed. */
const personSummary = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  kind: z.enum(PERSON_KINDS),
  lifecycle,
  activeWorkCount: z.number().int().describe('Œuvres non archivées où la personne est créditée.'),
  updatedAt: recordVersion,
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: archivedByHandle,
}) satisfies z.ZodType<AdminPersonListItem>;

/** A person with their links. */
export const adminPersonSchema = personSummary.extend({
  links: z.array(link),
}) satisfies z.ZodType<AdminPersonDetail>;

/** A page of people. */
export const adminPersonPageSchema = pageOf(personSummary) satisfies z.ZodType<
  Page<AdminPersonListItem>
>;

/** A publisher or platform. */
export const adminPublisherSchema = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  kind: z.enum(PUBLISHER_KINDS),
  url: z.string().nullable(),
  lifecycle,
  activeWorkCount: z.number().int().describe('Œuvres non archivées publiées.'),
  updatedAt: recordVersion,
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: archivedByHandle,
}) satisfies z.ZodType<AdminPublisherListItem>;

/** A page of publishers. */
export const adminPublisherPageSchema = pageOf(adminPublisherSchema) satisfies z.ZodType<
  Page<AdminPublisherListItem>
>;

/** Identity and status of a work. */
const workSummary = z.strictObject({
  id: z.number().int(),
  title: z.string(),
  originalLanguage: z.string(),
  type: z.enum(WORK_TYPES),
  status: z.enum(WORK_STATUSES),
  lifecycle,
}) satisfies z.ZodType<AdminWorkSummary>;

/** Name of a cited record. */
const recordLabel = z.strictObject({ id: z.number().int(), label: z.string() });

/** A full work record for editing. */
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
  labels: z
    .strictObject({
      people: z.array(recordLabel),
      publishers: z.array(recordLabel),
      works: z.array(recordLabel),
    })
    .describe('Noms des personnes, éditeurs et œuvres liées cités, triés par identifiant.'),
  followerCount: z.number().int().describe('Membres qui ont l’œuvre dans leur liste de lecture.'),
  updatedAt: recordVersion,
  publicationGaps: z
    .array(z.enum(PUBLICATION_GAPS))
    .describe('Champs qui manquent pour publier l’œuvre (noms des champs de l’API).'),
}) satisfies z.ZodType<AdminWorkDetail>;

/** A work as listed. */
const workListItem = workSummary.extend({
  formats: z.array(z.string()).describe('Codes de format, triés.'),
  mainAuthor: z.string().nullable(),
  updatedAt: z.iso.datetime().describe('Dernière modification.'),
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: archivedByHandle,
  completeness: z
    .number()
    .int()
    .describe('0 à 100, par quarts : synopsis, éditeur, lien, couverture.'),
}) satisfies z.ZodType<AdminWorkListItem>;

/** Number of drafts of each administered resource. */
export const adminDraftCountsSchema = z.strictObject({
  works: z.number().int(),
  people: z.number().int(),
  publishers: z.number().int(),
}) satisfies z.ZodType<DraftCounts>;

/** A page of works. */
export const adminWorkPageSchema = pageOf(workListItem) satisfies z.ZodType<
  Page<AdminWorkListItem>
>;
