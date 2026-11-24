/** Queries for administering publishers and platforms: list, read, write and archive. */
import { sql } from 'kysely';
import type { Db, PublisherKind } from '../db/database.js';
import {
  archiveColumns,
  countDraftRows,
  deleteRecordRow,
  falseWhenCited,
  FILTERED_TOTAL,
  findNamesakes,
  isVersion,
  lifecycleCondition,
  lifecycleOf,
  lockRow,
  namedListOrder,
  nameContains,
  publishedAtOnUpdate,
  totalOf,
  versionOf,
  type AdminSort,
  type Lifecycle,
  type LifecycleFilter,
  type Namesakes,
} from './admin-sql.js';

/** Data sent to create a publisher; `published` publishes a draft (never the reverse). */
export interface AdminPublisherCreateInput {
  name: string;
  kind: PublisherKind;
  url: string | null;
  published: boolean;
}

/** A publisher as listed and as served for editing: its list line already holds every field. */
export interface AdminPublisherListItem extends Omit<AdminPublisherCreateInput, 'published'> {
  id: number;
  /** A draft is only visible in the administration. */
  lifecycle: Lifecycle;
  /** Unarchived works published by this publisher or platform. */
  activeWorkCount: number;
  /** Record version (ISO 8601 date, to the millisecond): send it back with the replacement. */
  updatedAt: string;
  archivedAt: string | null;
  /** Handle of the administrator who archived the publisher. */
  archivedBy: string | null;
}

/** Search, lifecycle, sort and page of a publisher list. */
export interface AdminPublisherListCriteria {
  q?: string;
  lifecycle: LifecycleFilter;
  sort: AdminSort;
  limit: number;
  offset: number;
}

/** Publisher administration queries. */
export interface AdminPublisherRepository {
  list(
    criteria: AdminPublisherListCriteria,
  ): Promise<{ items: AdminPublisherListItem[]; total: number }>;
  find(id: number): Promise<AdminPublisherListItem | null>;
  create(input: AdminPublisherCreateInput): Promise<number>;
  /** False if the publisher does not exist, or if `version` is no longer the record's; publishes a draft when asked. */
  update(id: number, input: AdminPublisherCreateInput, version: string): Promise<boolean>;
  /**
   * False if the publisher does not exist, or, when archiving, if an unarchived work lists it.
   * `adminId` is who archives, ignored on restore.
   */
  setArchived(id: number, archived: boolean, adminId: number): Promise<boolean>;
  /** Deletes a draft nothing cites; false if it is not a draft or a work lists it. */
  deleteRecord(id: number): Promise<boolean>;
  countDrafts(): Promise<number>;
  /** Publishers bearing the same name, archives included, `excludeId` left out. */
  findNamesakes(name: string, excludeId?: number): Promise<Namesakes>;
}

/** Columns read for a publisher summary. */
interface ListItemRow {
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
function toListItem(row: ListItemRow): AdminPublisherListItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    lifecycle: lifecycleOf(row),
    activeWorkCount: row.activeWorkCount,
    updatedAt: row.version.toISOString(),
    archivedAt: row.deleted_at?.toISOString() ?? null,
    archivedBy: row.archivedBy,
  };
}

/** Creates the publisher administration repository. */
export function createAdminPublisherRepository(db: Db): AdminPublisherRepository {
  /** Publishers matching the search text and lifecycle. */
  function filtered({ q, lifecycle }: Pick<AdminPublisherListCriteria, 'q' | 'lifecycle'>) {
    let query = db.selectFrom('publisher').where(lifecycleCondition('publisher', lifecycle));
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
        .orderBy(namedListOrder(criteria.sort, 'publisher'))
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
      return { items: rows.map(toListItem), total };
    },

    async find(id) {
      const row = await selectSummaries(db.selectFrom('publisher'))
        .where('publisher.id', '=', id)
        .executeTakeFirst();
      return row ? toListItem(row) : null;
    },

    async create({ name, kind, url, published }) {
      const { id } = await db
        .insertInto('publisher')
        .values({ name, kind, url, published_at: published ? sql<Date>`now()` : null })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    async deleteRecord(id) {
      return falseWhenCited(() => deleteRecordRow(db, 'publisher', id));
    },

    async countDrafts() {
      return countDraftRows(db, 'publisher');
    },

    findNamesakes: (name, excludeId) => findNamesakes(db, 'publisher', 'name', name, excludeId),

    async update(id, { name, kind, url, published }, version) {
      const row = await db
        .updateTable('publisher')
        .set({
          name,
          kind,
          url,
          published_at: publishedAtOnUpdate(published),
          updated_at: sql<Date>`now()`,
        })
        .where('id', '=', id)
        .where(isVersion('publisher', version))
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },

    async setArchived(id, archived, adminId) {
      return db.transaction().execute(async (trx) => {
        // Locked first: the guard sees a work that listed the publisher while this archive waited.
        if (archived) await lockRow(trx, 'publisher', id);
        let query = trx
          .updateTable('publisher')
          .set(archiveColumns(archived, adminId))
          .where('id', '=', id);
        if (archived) query = query.where(NO_ACTIVE_WORK_OF_PUBLISHER);
        const row = await query.returning('id').executeTakeFirst();
        return row !== undefined;
      });
    },
  };
}
