import { sql, type RawBuilder, type SelectQueryBuilder, type Transaction } from 'kysely';
import type {
  CreditRole,
  Database,
  Db,
  RelationKind,
  SynopsisSource,
  TitleKind,
  WorkStatus,
  WorkType,
} from '../db/database.js';
import {
  archiveCondition,
  COMPLETENESS_PERCENT,
  FILTERED_TOTAL,
  FORMAT_CODES,
  MAIN_AUTHOR_NAME,
  nameContains,
  totalOf,
  type ArchiveScope,
} from './admin-sql.js';
import { replaceLinks, type ExternalLinkRecord } from './external-link.repository.js';

export interface WorkTitleRecord {
  language: string;
  kind: TitleKind;
  title: string;
}

export interface WorkSynopsisRecord {
  language: string;
  text: string;
  source: SynopsisSource;
}

export interface WorkCreditRecord {
  personId: number;
  role: CreditRole;
}

export interface WorkRelationRecord {
  relatedWorkId: number;
  relation: RelationKind;
}

/** Tout ce qu'une fiche œuvre contient, hors couverture (envoi d'images traité à part). */
export interface WorkDraft {
  title: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  chapters: number | null;
  volumes: number | null;
  startedOn: string | null;
  endedOn: string | null;
  titles: WorkTitleRecord[];
  synopses: WorkSynopsisRecord[];
  credits: WorkCreditRecord[];
  publisherIds: number[];
  /** Codes de format et de genre. */
  genres: string[];
  relations: WorkRelationRecord[];
  links: ExternalLinkRecord[];
}

export interface AdminWorkSummary {
  id: number;
  title: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  archived: boolean;
}

/** Une ligne du catalogue d'administration. */
export interface AdminWorkListItem extends AdminWorkSummary {
  formats: string[];
  mainAuthor: string | null;
  /** Dates ISO 8601. */
  updatedAt: string;
  /** Quand et par qui, pour une œuvre archivée. */
  archivedAt: string | null;
  archivedBy: string | null;
  /** 0 à 100, par quarts : synopsis, éditeur, lien, couverture. */
  completeness: number;
}

export interface AdminWorkRecord extends WorkDraft {
  id: number;
  archived: boolean;
  /** Membres qui ont l'œuvre dans leur liste de lecture. */
  followerCount: number;
  /** Version de la fiche (date ISO 8601, à la milliseconde) : à renvoyer avec le remplacement. */
  updatedAt: string;
}

/** Références d'un brouillon qui n'existent pas en base. */
export interface MissingReferences {
  personIds: number[];
  publisherIds: number[];
  workIds: number[];
  genres: string[];
}

/** Références d'un brouillon qui existent mais sont archivées. */
export interface ArchivedReferences {
  personIds: number[];
  publisherIds: number[];
  workIds: number[];
}

export interface AdminWorkListCriteria {
  q?: string;
  scope: ArchiveScope;
  sort: 'title' | 'title_desc' | 'completeness' | 'completeness_desc';
  types?: WorkType[];
  statuses?: WorkStatus[];
  /** Codes de format : l'œuvre doit en avoir un. */
  formats?: string[];
  limit: number;
  offset: number;
}

export interface AdminWorkRepository {
  list(criteria: AdminWorkListCriteria): Promise<{ items: AdminWorkListItem[]; total: number }>;
  /** Archivée ou non. */
  find(id: number): Promise<AdminWorkRecord | null>;
  findMissingReferences(draft: WorkDraft): Promise<MissingReferences>;
  findArchivedReferences(draft: WorkDraft): Promise<ArchivedReferences>;
  create(draft: WorkDraft): Promise<number>;
  /** Faux si l'œuvre n'existe pas, ou si `version` n'est plus celle de la fiche. */
  update(id: number, draft: WorkDraft, version?: string): Promise<boolean>;
  /** Faux si l'œuvre n'existe pas. `adminId` : qui archive, ignoré à la restauration. */
  setArchived(id: number, archived: boolean, adminId: number): Promise<boolean>;
}

type Trx = Transaction<Database>;

async function insertAll(trx: Trx, workId: number, draft: WorkDraft): Promise<void> {
  const { titles, synopses, credits, publisherIds, relations } = draft;
  if (titles.length > 0) {
    await trx
      .insertInto('work_title')
      .values(titles.map((title) => ({ work_id: workId, ...title })))
      .execute();
  }
  if (synopses.length > 0) {
    await trx
      .insertInto('work_synopsis')
      .values(synopses.map((synopsis) => ({ work_id: workId, ...synopsis })))
      .execute();
  }
  if (credits.length > 0) {
    await trx
      .insertInto('work_credit')
      .values(credits.map(({ personId, role }) => ({ work_id: workId, person_id: personId, role })))
      .execute();
  }
  if (publisherIds.length > 0) {
    await trx
      .insertInto('work_publisher')
      .values(publisherIds.map((publisherId) => ({ work_id: workId, publisher_id: publisherId })))
      .execute();
  }
  if (relations.length > 0) {
    await trx
      .insertInto('work_relation')
      .values(
        relations.map(({ relatedWorkId, relation }) => ({
          work_id: workId,
          related_work_id: relatedWorkId,
          relation,
        })),
      )
      .execute();
  }
}

async function insertGenres(trx: Trx, workId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  const genres = await trx.selectFrom('genre').select('id').where('code', 'in', codes).execute();
  await trx
    .insertInto('work_genre')
    .values(genres.map(({ id }) => ({ work_id: workId, genre_id: id })))
    .execute();
}

async function deleteChildren(trx: Trx, workId: number): Promise<void> {
  await trx.deleteFrom('work_title').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_synopsis').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_credit').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_publisher').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_genre').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_relation').where('work_id', '=', workId).execute();
}

async function writeChildren(trx: Trx, workId: number, draft: WorkDraft): Promise<void> {
  await insertAll(trx, workId, draft);
  await insertGenres(trx, workId, draft.genres);
  await replaceLinks(trx, { workId }, draft.links);
}

function workColumns(draft: WorkDraft) {
  return {
    title: draft.title,
    original_language: draft.originalLanguage,
    type: draft.type,
    status: draft.status,
    chapters: draft.chapters,
    volumes: draft.volumes,
    started_on: draft.startedOn,
    ended_on: draft.endedOn,
  };
}

/**
 * Version d'une fiche : `updated_at` à la milliseconde, la précision d'une date JavaScript
 * (Postgres garde les microsecondes, une date ISO renvoyée par l'API les perd).
 */
const VERSION = sql<Date>`date_trunc('milliseconds', updated_at)`;
const isVersion = (version: string) => sql<boolean>`${VERSION} = ${version}::timestamptz`;

/** L'œuvre a au moins un des formats (manga, webtoon…). */
function hasFormat(codes: string[]): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
    WHERE wg.work_id = work.id AND g.category = 'format' AND g.code IN (${sql.join(codes)})
  )`;
}

/** Le titre de l'œuvre, ou le nom d'une personne créditée, contient le texte. */
function titleOrAuthorContains(text: string): RawBuilder<boolean> {
  return sql<boolean>`(${nameContains('work.title', text)} OR EXISTS (
    SELECT 1 FROM work_credit wc JOIN person p ON p.id = wc.person_id
    WHERE wc.work_id = work.id AND p.deleted_at IS NULL AND ${nameContains('p.name', text)}
  ))`;
}

/** Tri de la liste ; le titre départage toujours (puis l'identifiant, ajouté par l'appelant). */
function orderWorks<O>(
  query: SelectQueryBuilder<Database, 'work' | 'app_user', O>,
  sort: AdminWorkListCriteria['sort'],
) {
  const byTitle = sql`immutable_unaccent(work.title)`;
  switch (sort) {
    case 'title_desc':
      return query.orderBy(byTitle, 'desc');
    case 'completeness':
      return query.orderBy(COMPLETENESS_PERCENT, 'asc').orderBy(byTitle);
    case 'completeness_desc':
      return query.orderBy(COMPLETENESS_PERCENT, 'desc').orderBy(byTitle);
    default:
      return query.orderBy(byTitle);
  }
}

export function createAdminWorkRepository(db: Db): AdminWorkRepository {
  function filtered(criteria: Omit<AdminWorkListCriteria, 'sort' | 'limit' | 'offset'>) {
    const { q, scope, types, statuses, formats } = criteria;
    let query = db.selectFrom('work');
    const archive = archiveCondition('work.deleted_at', scope);
    if (archive) query = query.where(archive);
    if (q !== undefined) query = query.where(titleOrAuthorContains(q));
    if (types?.length) query = query.where('work.type', 'in', types);
    if (statuses?.length) query = query.where('work.status', 'in', statuses);
    if (formats?.length) query = query.where(hasFormat(formats));
    return query;
  }

  async function findExistingIds(table: 'person' | 'publisher' | 'work', ids: number[]) {
    if (ids.length === 0) return new Set<number>();
    const rows = await db.selectFrom(table).select('id').where('id', 'in', ids).execute();
    return new Set(rows.map((row) => row.id));
  }

  async function findArchivedIds(table: 'person' | 'publisher' | 'work', ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await db
      .selectFrom(table)
      .select('id')
      .where('id', 'in', ids)
      .where('deleted_at', 'is not', null)
      .execute();
    return rows.map((row) => row.id);
  }

  return {
    async list(criteria) {
      const rows = await filtered(criteria)
        .leftJoin('app_user', 'app_user.id', 'work.deleted_by')
        .select([
          'work.id',
          'work.title',
          'work.original_language',
          'work.type',
          'work.status',
          'work.updated_at',
          'work.deleted_at',
          'app_user.handle as archivedBy',
        ])
        .select(MAIN_AUTHOR_NAME.as('mainAuthor'))
        .select(FORMAT_CODES.as('formats'))
        .select(COMPLETENESS_PERCENT.as('completeness'))
        .select(FILTERED_TOTAL.as('total'))
        .$call((query) => orderWorks(query, criteria.sort))
        .orderBy('work.id')
        .limit(criteria.limit)
        .offset(criteria.offset)
        .execute();
      const total = await totalOf(rows, async () => {
        const counted = await filtered(criteria)
          .select((eb) => eb.fn.countAll<number>().as('total'))
          .executeTakeFirstOrThrow();
        return counted.total;
      });
      const items = rows.map((row) => ({
        id: row.id,
        title: row.title,
        originalLanguage: row.original_language,
        type: row.type,
        status: row.status,
        archived: row.deleted_at !== null,
        formats: row.formats,
        mainAuthor: row.mainAuthor,
        updatedAt: row.updated_at.toISOString(),
        archivedAt: row.deleted_at?.toISOString() ?? null,
        archivedBy: row.archivedBy,
        completeness: row.completeness,
      }));
      return { items, total };
    },

    async find(id) {
      const work = await db
        .selectFrom('work')
        .select([
          'id',
          'title',
          'original_language',
          'type',
          'status',
          'chapters',
          'volumes',
          'started_on',
          'ended_on',
          'deleted_at',
        ])
        .select(VERSION.as('version'))
        .where('id', '=', id)
        .executeTakeFirst();
      if (!work) return null;
      const [titles, synopses, credits, publishers, genres, relations, links, followers] =
        await Promise.all([
          db
            .selectFrom('work_title')
            .select(['language', 'kind', 'title'])
            .where('work_id', '=', id)
            .orderBy('language')
            .orderBy('title')
            .execute(),
          db
            .selectFrom('work_synopsis')
            .select(['language', 'text', 'source'])
            .where('work_id', '=', id)
            .orderBy('language')
            .execute(),
          db
            .selectFrom('work_credit')
            .select(['person_id as personId', 'role'])
            .where('work_id', '=', id)
            .orderBy('person_id')
            .orderBy('role')
            .execute(),
          db
            .selectFrom('work_publisher')
            .select('publisher_id')
            .where('work_id', '=', id)
            .orderBy('publisher_id')
            .execute(),
          db
            .selectFrom('work_genre')
            .innerJoin('genre', 'genre.id', 'work_genre.genre_id')
            .select('genre.code')
            .where('work_genre.work_id', '=', id)
            .orderBy('genre.code')
            .execute(),
          db
            .selectFrom('work_relation')
            .select(['related_work_id as relatedWorkId', 'relation'])
            .where('work_id', '=', id)
            .orderBy('related_work_id')
            .execute(),
          db
            .selectFrom('external_link')
            .select(['kind', 'url', 'label'])
            .where('work_id', '=', id)
            .orderBy('id')
            .execute(),
          db
            .selectFrom('library_entry')
            .select((eb) => eb.fn.countAll<number>().as('total'))
            .where('work_id', '=', id)
            .executeTakeFirstOrThrow(),
        ]);
      return {
        id: work.id,
        title: work.title,
        originalLanguage: work.original_language,
        type: work.type,
        status: work.status,
        chapters: work.chapters,
        volumes: work.volumes,
        startedOn: work.started_on,
        endedOn: work.ended_on,
        archived: work.deleted_at !== null,
        titles,
        synopses,
        credits,
        publisherIds: publishers.map((row) => row.publisher_id),
        genres: genres.map((row) => row.code),
        relations,
        links,
        followerCount: followers.total,
        updatedAt: work.version.toISOString(),
      };
    },

    async findMissingReferences(draft) {
      const personIds = [...new Set(draft.credits.map((credit) => credit.personId))];
      const workIds = draft.relations.map((relation) => relation.relatedWorkId);
      const [people, publishers, works, genres] = await Promise.all([
        findExistingIds('person', personIds),
        findExistingIds('publisher', draft.publisherIds),
        findExistingIds('work', workIds),
        draft.genres.length === 0
          ? []
          : db.selectFrom('genre').select('code').where('code', 'in', draft.genres).execute(),
      ]);
      const knownGenres = new Set(genres.map((genre) => genre.code));
      return {
        personIds: personIds.filter((id) => !people.has(id)),
        publisherIds: draft.publisherIds.filter((id) => !publishers.has(id)),
        workIds: workIds.filter((id) => !works.has(id)),
        genres: draft.genres.filter((code) => !knownGenres.has(code)),
      };
    },

    async findArchivedReferences(draft) {
      const [personIds, publisherIds, workIds] = await Promise.all([
        findArchivedIds('person', [...new Set(draft.credits.map((credit) => credit.personId))]),
        findArchivedIds('publisher', draft.publisherIds),
        findArchivedIds(
          'work',
          draft.relations.map((relation) => relation.relatedWorkId),
        ),
      ]);
      return { personIds, publisherIds, workIds };
    },

    async create(draft) {
      return db.transaction().execute(async (trx) => {
        const { id } = await trx
          .insertInto('work')
          .values(workColumns(draft))
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeChildren(trx, id, draft);
        return id;
      });
    },

    async update(id, draft, version) {
      return db.transaction().execute(async (trx) => {
        let query = trx
          .updateTable('work')
          .set({ ...workColumns(draft), updated_at: sql<Date>`now()` })
          .where('id', '=', id);
        if (version !== undefined) query = query.where(isVersion(version));
        const row = await query.returning('id').executeTakeFirst();
        if (!row) return false;
        await deleteChildren(trx, id);
        await writeChildren(trx, id, draft);
        return true;
      });
    },

    async setArchived(id, archived, adminId) {
      const row = await db
        .updateTable('work')
        .set({
          deleted_at: archived ? sql<Date>`now()` : null,
          deleted_by: archived ? adminId : null,
          updated_at: sql<Date>`now()`,
        })
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },
  };
}
