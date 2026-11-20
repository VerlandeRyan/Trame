/** Queries for administering works: list, read, write (with all child tables) and archive. */
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
  archiveColumns,
  COMPLETENESS_PERCENT,
  countDraftRows,
  deleteRecordRow,
  DRAFTS_FIRST,
  FILTERED_TOTAL,
  FORMAT_CODES,
  isVersion,
  lifecycleCondition,
  lifecycleOf,
  lockRow,
  MAIN_AUTHOR_NAME,
  nameContains,
  publishedAtOnUpdate,
  REMOVABLE,
  totalOf,
  versionOf,
  type Lifecycle,
  type LifecycleFilter,
} from './admin-sql.js';
import { replaceLinks, type ExternalLinkRecord } from './external-link.repository.js';

/** No other work lists this one as related. */
const NOT_RELATED = sql<boolean>`NOT EXISTS (SELECT 1 FROM work_relation wr WHERE wr.related_work_id = work.id)`;

/** An alternative title of a work. */
export interface WorkTitleRecord {
  language: string;
  kind: TitleKind;
  title: string;
}

/** A synopsis of a work in one language. */
export interface WorkSynopsisRecord {
  language: string;
  text: string;
  source: SynopsisSource;
}

/** A person credited on a work with a role. */
export interface WorkCreditRecord {
  personId: number;
  role: CreditRole;
}

/** A link from a work to a related work. */
export interface WorkRelationRecord {
  relatedWorkId: number;
  relation: RelationKind;
}

/**
 * Data sent to create a work: everything a work contains, except the cover (image upload is
 * handled separately). `UpdateInput` adds the version to replace one.
 */
export interface AdminWorkCreateInput {
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
  /** Format and genre codes. */
  genres: string[];
  relations: WorkRelationRecord[];
  links: ExternalLinkRecord[];
  /** Publishes a draft (at creation or when replacing it); never unpublishes. */
  published: boolean;
}

/** Identity and status of a work. */
export interface AdminWorkSummary {
  id: number;
  title: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  /** A draft is only visible in the administration. */
  lifecycle: Lifecycle;
}

/** One row of the administration catalogue. */
export interface AdminWorkListItem extends AdminWorkSummary {
  formats: string[];
  mainAuthor: string | null;
  /** ISO 8601 dates. */
  updatedAt: string;
  /** When and by whom, for an archived work. */
  archivedAt: string | null;
  archivedBy: string | null;
  /** 0 to 100, by quarters: synopsis, publisher, link, cover. */
  completeness: number;
}

/** Name of a record cited by a work (archived or not), used to fill the selectors. */
export interface RecordLabel {
  id: number;
  label: string;
}

/** Names of the people, publishers and related works a work cites. */
export interface WorkReferenceLabels {
  people: RecordLabel[];
  publishers: RecordLabel[];
  works: RecordLabel[];
}

/**
 * A work as stored, read for editing. The service turns it into `AdminWorkDetail`: it drops
 * `hasFormat` and adds the publication gaps.
 */
export interface AdminWorkRaw extends Omit<AdminWorkCreateInput, 'published'> {
  id: number;
  lifecycle: Lifecycle;
  /** Names of the cited people, publishers and related works, sorted by identifier. */
  labels: WorkReferenceLabels;
  /** Members who have the work in their reading list. */
  followerCount: number;
  /** Record version (ISO 8601 date, to the millisecond): send it back with the replacement. */
  updatedAt: string;
  /** Whether one of the work's genres is a format (the service turns it into the publication gaps). */
  hasFormat: boolean;
}

/** References of an input that do not exist in the database. */
export interface MissingReferences {
  personIds: number[];
  publisherIds: number[];
  workIds: number[];
  genres: string[];
}

/** What an input cites: the references that do not exist, and whether one of its genres is a format. */
export interface ReferenceLookup {
  missing: MissingReferences;
  hasFormat: boolean;
}

/** References of an input that exist but are archived. */
export interface ArchivedReferences {
  personIds: number[];
  publisherIds: number[];
  workIds: number[];
}

/** Search, filters, sort and page of the administration work list. */
export interface AdminWorkListCriteria {
  q?: string;
  lifecycle: LifecycleFilter;
  sort: 'title' | 'title_desc' | 'completeness' | 'completeness_desc';
  types?: WorkType[];
  statuses?: WorkStatus[];
  /** Format codes: the work must have one of them. */
  formats?: string[];
  limit: number;
  offset: number;
}

/** Work administration queries. */
export interface AdminWorkRepository {
  list(criteria: AdminWorkListCriteria): Promise<{ items: AdminWorkListItem[]; total: number }>;
  /** Archived or not. */
  find(id: number): Promise<AdminWorkRaw | null>;
  /**
   * Creates the work. `check` runs inside the write transaction, once the cited records are
   * locked: what it throws rolls the creation back.
   */
  create(input: AdminWorkCreateInput, check: ReferenceCheck): Promise<number>;
  /** Deletes a draft no other work relates to; false if it is not a draft or is related. */
  deleteRecord(id: number): Promise<boolean>;
  countDrafts(): Promise<number>;
  /**
   * False if the work does not exist, or if `version` is no longer the record's; publishes a draft
   * when asked. `check` runs inside the write transaction, once the cited records are locked, so
   * they cannot be archived or turned back into drafts between the check and the write.
   */
  update(
    id: number,
    input: AdminWorkCreateInput,
    version: string,
    check: ReferenceCheck,
  ): Promise<boolean>;
  /** False if the work does not exist. `adminId` is who archives, ignored on restore. */
  setArchived(id: number, archived: boolean, adminId: number): Promise<boolean>;
}

/** Reads what a work cites, on the connection or the transaction it was created for. */
export interface ReferenceReader {
  /** Looks up what the input cites: the references that do not exist, and whether it carries a format. */
  lookUpReferences(input: AdminWorkCreateInput): Promise<ReferenceLookup>;
  findArchivedReferences(input: AdminWorkCreateInput): Promise<ArchivedReferences>;
  /** References of the input that are themselves drafts (same shape as the archived ones). */
  findDraftReferences(input: AdminWorkCreateInput): Promise<ArchivedReferences>;
}

/** A rule on the cited records, run by the repository inside its write transaction. */
export type ReferenceCheck = (references: ReferenceReader) => Promise<void>;

type Trx = Transaction<Database>;

/** Tables a work can cite. */
type ReferenceTable = 'person' | 'publisher' | 'work';

/** Identifiers among `ids` that exist in the table. */
async function findExistingIds(q: Db, table: ReferenceTable, ids: number[]) {
  if (ids.length === 0) return new Set<number>();
  const rows = await q.selectFrom(table).select('id').where('id', 'in', ids).execute();
  return new Set(rows.map((row) => row.id));
}

/** Identifiers among `ids` that are archived, or drafts. */
async function findFlaggedIds(
  q: Db,
  table: ReferenceTable,
  ids: number[],
  flag: 'archived' | 'draft',
) {
  if (ids.length === 0) return [];
  const query = q.selectFrom(table).select('id').where('id', 'in', ids);
  const rows = await (
    flag === 'archived'
      ? query.where('deleted_at', 'is not', null)
      : query.where('published_at', 'is', null)
  ).execute();
  return rows.map((row) => row.id);
}

/** The identifiers of the people, publishers and related works an input cites. */
function citedIds(input: AdminWorkCreateInput) {
  return {
    personIds: [...new Set(input.credits.map((credit) => credit.personId))],
    publisherIds: [...new Set(input.publisherIds)],
    workIds: [...new Set(input.relations.map((relation) => relation.relatedWorkId))],
  };
}

/** The people, publishers and related works an input cites that are archived, or drafts. */
async function findFlaggedReferences(
  q: Db,
  input: AdminWorkCreateInput,
  flag: 'archived' | 'draft',
) {
  const { personIds, publisherIds, workIds } = citedIds(input);
  const [people, publishers, works] = await Promise.all([
    findFlaggedIds(q, 'person', personIds, flag),
    findFlaggedIds(q, 'publisher', publisherIds, flag),
    findFlaggedIds(q, 'work', workIds, flag),
  ]);
  return { personIds: people, publisherIds: publishers, workIds: works };
}

/** The reference reads on a connection (`db`) or a transaction. */
function createReferenceReader(q: Db): ReferenceReader {
  return {
    async lookUpReferences(input) {
      const { personIds, publisherIds, workIds } = citedIds(input);
      const [people, publishers, works, genres] = await Promise.all([
        findExistingIds(q, 'person', personIds),
        findExistingIds(q, 'publisher', publisherIds),
        findExistingIds(q, 'work', workIds),
        input.genres.length === 0
          ? []
          : q
              .selectFrom('genre')
              .select(['code', 'category'])
              .where('code', 'in', input.genres)
              .execute(),
      ]);
      const knownGenres = new Set(genres.map((genre) => genre.code));
      return {
        missing: {
          personIds: personIds.filter((id) => !people.has(id)),
          publisherIds: publisherIds.filter((id) => !publishers.has(id)),
          workIds: workIds.filter((id) => !works.has(id)),
          genres: input.genres.filter((code) => !knownGenres.has(code)),
        },
        hasFormat: genres.some((genre) => genre.category === 'format'),
      };
    },

    findArchivedReferences: (input) => findFlaggedReferences(q, input, 'archived'),

    findDraftReferences: (input) => findFlaggedReferences(q, input, 'draft'),
  };
}

/**
 * Locks the cited records then runs `check` on them: an archive or a publication of a cited record
 * waits for this transaction, so what the check saw still holds when the work is written.
 * People and publishers are locked shared, by identifier. The work rows (the cited ones and the
 * edited one, `ownWorkId`) are locked together in one statement ordered by identifier, so two works
 * that cite each other, saved at the same time, queue instead of deadlocking. `FOR NO KEY UPDATE`
 * is what the later `UPDATE` takes anyway; it lets members add the work to their list meanwhile.
 */
async function checkReferencesLocked(
  trx: Trx,
  input: AdminWorkCreateInput,
  check: ReferenceCheck,
  ownWorkId?: number,
): Promise<void> {
  const { personIds, publisherIds, workIds } = citedIds(input);
  /** Locks the rows shared, ordered by identifier; nothing to lock for an empty list. */
  const lockShared = async (table: 'person' | 'publisher', ids: number[]) => {
    if (ids.length === 0) return;
    await trx
      .selectFrom(table)
      .select('id')
      .where('id', 'in', ids)
      .orderBy('id')
      .forShare()
      .execute();
  };
  await lockShared('person', personIds);
  await lockShared('publisher', publisherIds);
  const lockedWorkIds = ownWorkId === undefined ? workIds : [...new Set([...workIds, ownWorkId])];
  if (lockedWorkIds.length > 0) {
    await trx
      .selectFrom('work')
      .select('id')
      .where('id', 'in', lockedWorkIds)
      .orderBy('id')
      .forNoKeyUpdate()
      .execute();
  }
  await check(createReferenceReader(trx));
}

/** Inserts the titles, synopses, credits, publishers and relations of an input. */
async function insertAll(trx: Trx, workId: number, input: AdminWorkCreateInput): Promise<void> {
  const { titles, synopses, credits, publisherIds, relations } = input;
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

/** Links the work to the genres with the given codes. */
async function insertGenres(trx: Trx, workId: number, codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  const genres = await trx.selectFrom('genre').select('id').where('code', 'in', codes).execute();
  await trx
    .insertInto('work_genre')
    .values(genres.map(({ id }) => ({ work_id: workId, genre_id: id })))
    .execute();
}

/** Deletes the child rows that a replacement rewrites (links are replaced separately). */
async function deleteChildren(trx: Trx, workId: number): Promise<void> {
  await trx.deleteFrom('work_title').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_synopsis').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_credit').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_publisher').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_genre').where('work_id', '=', workId).execute();
  await trx.deleteFrom('work_relation').where('work_id', '=', workId).execute();
}

/** Writes every child table of an input. */
async function writeChildren(trx: Trx, workId: number, input: AdminWorkCreateInput): Promise<void> {
  await insertAll(trx, workId, input);
  await insertGenres(trx, workId, input.genres);
  await replaceLinks(trx, { workId }, input.links);
}

/** Columns of the work table taken from an input. */
function workColumns(input: AdminWorkCreateInput) {
  return {
    title: input.title,
    original_language: input.originalLanguage,
    type: input.type,
    status: input.status,
    chapters: input.chapters,
    volumes: input.volumes,
    started_on: input.startedOn,
    ended_on: input.endedOn,
  };
}

/** The work has at least one of the formats (manga, webtoon…). */
function hasFormat(codes: string[]): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
    WHERE wg.work_id = work.id AND g.category = 'format' AND g.code IN (${sql.join(codes)})
  )`;
}

/** The work title, or the name of a credited person, contains the text. */
function titleOrAuthorContains(text: string): RawBuilder<boolean> {
  return sql<boolean>`(${nameContains('work.title', text)} OR EXISTS (
    SELECT 1 FROM work_credit wc JOIN person p ON p.id = wc.person_id
    WHERE wc.work_id = work.id AND p.deleted_at IS NULL AND ${nameContains('p.name', text)}
  ))`;
}

/** List sort; the title always breaks ties (then the identifier, added by the caller). */
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

/** Creates the work administration repository. */
export function createAdminWorkRepository(db: Db): AdminWorkRepository {
  /** Works matching the search, lifecycle and filters. */
  function filtered(criteria: Omit<AdminWorkListCriteria, 'sort' | 'limit' | 'offset'>) {
    const { q, lifecycle, types, statuses, formats } = criteria;
    let query = db.selectFrom('work').where(lifecycleCondition('work', lifecycle));
    if (q !== undefined) query = query.where(titleOrAuthorContains(q));
    if (types?.length) query = query.where('work.type', 'in', types);
    if (statuses?.length) query = query.where('work.status', 'in', statuses);
    if (formats?.length) query = query.where(hasFormat(formats));
    return query;
  }

  /** Names of the cited records, archived or not. */
  async function findReferenceLabels(
    personIds: number[],
    publisherIds: number[],
    workIds: number[],
  ): Promise<WorkReferenceLabels> {
    const [people, publishers, works] = await Promise.all([
      personIds.length === 0
        ? []
        : db
            .selectFrom('person')
            .select(['id', 'name as label'])
            .where('id', 'in', personIds)
            .orderBy('id')
            .execute(),
      publisherIds.length === 0
        ? []
        : db
            .selectFrom('publisher')
            .select(['id', 'name as label'])
            .where('id', 'in', publisherIds)
            .orderBy('id')
            .execute(),
      workIds.length === 0
        ? []
        : db
            .selectFrom('work')
            .select(['id', 'title as label'])
            .where('id', 'in', workIds)
            .orderBy('id')
            .execute(),
    ]);
    return { people, publishers, works };
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
          'work.published_at',
          'app_user.handle as archivedBy',
        ])
        .select(MAIN_AUTHOR_NAME.as('mainAuthor'))
        .select(FORMAT_CODES.as('formats'))
        .select(COMPLETENESS_PERCENT.as('completeness'))
        .select(FILTERED_TOTAL.as('total'))
        .orderBy(DRAFTS_FIRST('work.published_at'))
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
        lifecycle: lifecycleOf(row),
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
          'published_at',
        ])
        .select(versionOf('work').as('version'))
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
            .select(['genre.code', 'genre.category'])
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
      const publisherIds = publishers.map((row) => row.publisher_id);
      const labels = await findReferenceLabels(
        [...new Set(credits.map((credit) => credit.personId))],
        publisherIds,
        relations.map((relation) => relation.relatedWorkId),
      );
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
        lifecycle: lifecycleOf(work),
        labels,
        titles,
        synopses,
        credits,
        publisherIds,
        genres: genres.map((row) => row.code),
        relations,
        links,
        followerCount: followers.total,
        updatedAt: work.version.toISOString(),
        hasFormat: genres.some((row) => row.category === 'format'),
      };
    },

    async create(input, check) {
      return db.transaction().execute(async (trx) => {
        await checkReferencesLocked(trx, input, check);
        const { id } = await trx
          .insertInto('work')
          .values({
            ...workColumns(input),
            published_at: input.published ? sql<Date>`now()` : null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeChildren(trx, id, input);
        return id;
      });
    },

    async update(id, input, version, check) {
      return db.transaction().execute(async (trx) => {
        await checkReferencesLocked(trx, input, check, id);
        const row = await trx
          .updateTable('work')
          .set({
            ...workColumns(input),
            published_at: publishedAtOnUpdate(input.published),
            updated_at: sql<Date>`now()`,
          })
          .where('id', '=', id)
          .where(isVersion('work', version))
          .returning('id')
          .executeTakeFirst();
        if (!row) return false;
        await deleteChildren(trx, id);
        await writeChildren(trx, id, input);
        return true;
      });
    },

    async deleteRecord(id) {
      return db.transaction().execute(async (trx) => {
        // The row lock makes a member's concurrent "add to my list" wait for the outcome; taken in a
        // statement of its own so the guard below sees a relation committed while this delete waited.
        await lockRow(trx, 'work', id);
        const removable = await sql`
          SELECT id FROM work
          WHERE id = ${id} AND ${REMOVABLE} AND ${NOT_RELATED}
          FOR UPDATE`.execute(trx);
        if (removable.rows.length === 0) return false;
        // Members' lists are erased explicitly: the foreign keys stay strict for any other delete.
        await trx.deleteFrom('reading_event').where('work_id', '=', id).execute();
        await trx.deleteFrom('library_entry').where('work_id', '=', id).execute();
        return deleteRecordRow(trx, 'work', id, NOT_RELATED);
      });
    },

    async countDrafts() {
      return countDraftRows(db, 'work');
    },

    async setArchived(id, archived, adminId) {
      const row = await db
        .updateTable('work')
        .set(archiveColumns(archived, adminId))
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },
  };
}
