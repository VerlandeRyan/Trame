/** Queries for administering publishers and platforms: list, read, write and archive. */
import { sql } from 'kysely';
import type { Db, PublisherKind } from '../db/database.js';
import {
  archiveColumns,
  archiveCondition,
  countDraftRows,
  deleteRecordRow,
  DRAFTS_FIRST,
  FILTERED_TOTAL,
  isVersion,
  nameContains,
  publicationCondition,
  publishRow,
  totalOf,
  versionOf,
  type ArchiveScope,
  type PublicationState,
} from './admin-sql.js';

/** Data written when creating or replacing a publisher; `published` only counts at creation. */
export interface AdminPublisherDraft {
  name: string;
  kind: PublisherKind;
  url: string | null;
  published: boolean;
}

/** A publisher as shown in lists and details. */
export interface AdminPublisherSummary extends Omit<AdminPublisherDraft, 'published'> {
  id: number;
  archived: boolean;
  /** Not yet published: only visible in the administration. */
  draft: boolean;
  /** Unarchived works published by this publisher or platform. */
  activeWorkCount: number;
  /** Record version (ISO 8601 date, to the millisecond): send it back with the replacement. */
  updatedAt: string;
  archivedAt: string | null;
  /** Handle of the administrator who archived the publisher. */
  archivedBy: string | null;
}

/** Search, scope and page of a publisher list. */
export interface AdminPublisherListCriteria {
  q?: string;
  scope: ArchiveScope;
  state: PublicationState;
  limit: number;
  offset: number;
}

/** Publisher administration queries. */
export interface AdminPublisherRepository {
  list(
    criteria: AdminPublisherListCriteria,
  ): Promise<{ items: AdminPublisherSummary[]; total: number }>;
  find(id: number): Promise<AdminPublisherSummary | null>;
  create(draft: AdminPublisherDraft): Promise<number>;
  /** False if the publisher does not exist, or if `version` is no longer the record's. */
  update(id: number, draft: AdminPublisherDraft, version: string): Promise<boolean>;
  /**
   * False if the publisher does not exist, or, when archiving, if an unarchived work lists it.
   * `adminId` is who archives, ignored on restore.
   */
  setArchived(id: number, archived: boolean, adminId: number): Promise<boolean>;
  /** False if the publisher does not exist; publishing a published one changes nothing. */
  publish(id: number): Promise<boolean>;
  /** Deletes a draft nothing cites; false if it is not a draft or a work lists it. */
  deleteRecord(id: number): Promise<boolean>;
  countDrafts(): Promise<number>;
}

/** Columns read for a publisher summary. */
interface SummaryRow {
  id: number;
  name: string;
  kind: PublisherKind;
  url: string | null;
  deleted_at: Date | null;
  published_at: Date | null;
  activeWorkCount: number;
  version: Date;
  archivedBy: string | null;
}

/** Number of unarchived works published by the publisher. */
const ACTIVE_WORKS_OF_PUBLISHER = sql<number>`(
  SELECT count(*) FROM work_publisher wp JOIN work w ON w.id = wp.work_id
  WHERE wp.publisher_id = publisher.id AND w.deleted_at IS NULL
)`;

/** Archive guard, evaluated inside the `UPDATE`: a work added in the meantime makes it fail. */
const NO_ACTIVE_WORK_OF_PUBLISHER = sql<boolean>`NOT EXISTS (
  SELECT 1 FROM work_publisher wp JOIN work w ON w.id = wp.work_id
  WHERE wp.publisher_id = publisher.id AND w.deleted_at IS NULL
)`;

/** Converts a database row into a summary. */
function toSummary(row: SummaryRow): AdminPublisherSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    archived: row.deleted_at !== null,
    draft: row.published_at === null,
    activeWorkCount: row.activeWorkCount,
    updatedAt: row.version.toISOString(),
    archivedAt: row.deleted_at?.toISOString() ?? null,
    archivedBy: row.archivedBy,
  };
}

/** Creates the publisher administration repository. */
export function createAdminPublisherRepository(db: Db): AdminPublisherRepository {
  /** Publishers matching the search text and archive scope. */
  function filtered({
    q,
    scope,
    state,
  }: Pick<AdminPublisherListCriteria, 'q' | 'scope' | 'state'>) {
    let query = db.selectFrom('publisher');
    const archive = archiveCondition('publisher.deleted_at', scope);
    if (archive) query = query.where(archive);
    const publication = publicationCondition('publisher.published_at', state);
    if (publication) query = query.where(publication);
    if (q !== undefined) query = query.where(nameContains('publisher.name', q));
    return query;
  }

  /** Adds the summary columns to a filtered query. */
  function selectSummaries(query: ReturnType<typeof filtered>) {
    return query
      .leftJoin('app_user', 'app_user.id', 'publisher.deleted_by')
      .select(['publisher.id', 'publisher.name', 'publisher.kind', 'publisher.url'])
      .select(['publisher.deleted_at', 'publisher.published_at'])
      .select('app_user.handle as archivedBy')
      .select(ACTIVE_WORKS_OF_PUBLISHER.as('activeWorkCount'))
      .select(versionOf('publisher').as('version'));
  }

  return {
    async list(criteria) {
      const rows = await selectSummaries(filtered(criteria))
        .select(FILTERED_TOTAL.as('total'))
        .orderBy(DRAFTS_FIRST('publisher.published_at'))
        .orderBy(sql`immutable_unaccent(publisher.name)`)
        .orderBy('publisher.id')
        .limit(criteria.limit)
        .offset(criteria.offset)
        .execute();
      const total = await totalOf(rows, async () => {
        const counted = await filtered(criteria)
          .select((eb) => eb.fn.countAll<number>().as('total'))
          .executeTakeFirstOrThrow();
        return counted.total;
      });
      return { items: rows.map(toSummary), total };
    },

    async find(id) {
      const row = await selectSummaries(filtered({ scope: 'all', state: 'all' }))
        .where('publisher.id', '=', id)
        .executeTakeFirst();
      return row ? toSummary(row) : null;
    },

    async create({ name, kind, url, published }) {
      const { id } = await db
        .insertInto('publisher')
        .values({ name, kind, url, published_at: published ? sql<Date>`now()` : null })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    async publish(id) {
      return publishRow(db, 'publisher', id);
    },

    async deleteRecord(id) {
      return deleteRecordRow(
        db,
        'publisher',
        id,
        sql<boolean>`NOT EXISTS (SELECT 1 FROM work_publisher wp WHERE wp.publisher_id = publisher.id)`,
      );
    },

    async countDrafts() {
      return countDraftRows(db, 'publisher');
    },

    async update(id, { name, kind, url }, version) {
      const row = await db
        .updateTable('publisher')
        .set({ name, kind, url, updated_at: sql<Date>`now()` })
        .where('id', '=', id)
        .where(isVersion('publisher', version))
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },

    async setArchived(id, archived, adminId) {
      let query = db
        .updateTable('publisher')
        .set(archiveColumns(archived, adminId))
        .where('id', '=', id);
      if (archived) query = query.where(NO_ACTIVE_WORK_OF_PUBLISHER);
      const row = await query.returning('id').executeTakeFirst();
      return row !== undefined;
    },
  };
}
