/** Queries for administering people (creators): list, read, write and archive. */
import { sql, type Selectable } from 'kysely';
import type { Db, PersonKind, PersonRow } from '../db/database.js';
import {
  archiveColumns,
  countDraftRows,
  deleteRecordRow,
  DRAFTS_FIRST,
  FILTERED_TOTAL,
  isVersion,
  lifecycleCondition,
  lifecycleOf,
  lockRow,
  nameContains,
  publishedAtOnReplace,
  totalOf,
  versionOf,
  type Lifecycle,
  type LifecycleFilter,
} from './admin-sql.js';
import { replaceLinks, type ExternalLinkRecord } from './external-link.repository.js';

/** Data written when creating or replacing a person; `published` publishes a draft (never the reverse). */
export interface AdminPersonDraft {
  name: string;
  kind: PersonKind;
  links: ExternalLinkRecord[];
  published: boolean;
}

/** A person as shown in lists. */
export interface AdminPersonSummary {
  id: number;
  name: string;
  kind: PersonKind;
  /** A draft is only visible in the administration. */
  lifecycle: Lifecycle;
  /** Unarchived works crediting the person. */
  activeWorkCount: number;
  /** Record version (ISO 8601 date, to the millisecond): send it back with the replacement. */
  updatedAt: string;
  archivedAt: string | null;
  /** Handle of the administrator who archived the person. */
  archivedBy: string | null;
}

/** A person with their links. */
export interface AdminPersonRecord extends AdminPersonSummary {
  links: ExternalLinkRecord[];
}

/** Search, lifecycle and page of a people list. */
export interface AdminPersonListCriteria {
  q?: string;
  lifecycle: LifecycleFilter;
  limit: number;
  offset: number;
}

/** People administration queries. */
export interface AdminPersonRepository {
  list(criteria: AdminPersonListCriteria): Promise<{ items: AdminPersonSummary[]; total: number }>;
  find(id: number): Promise<AdminPersonRecord | null>;
  create(draft: AdminPersonDraft): Promise<number>;
  /** False if the person does not exist, or if `version` is no longer the record's; publishes a draft when asked. */
  update(id: number, draft: AdminPersonDraft, version: string): Promise<boolean>;
  /**
   * False if the person does not exist, or, when archiving, if an unarchived work credits them.
   * `adminId` is who archives, ignored on restore.
   */
  setArchived(id: number, archived: boolean, adminId: number): Promise<boolean>;
  /** Deletes a draft nothing cites; false if it is not a draft or a work credits it. */
  deleteRecord(id: number): Promise<boolean>;
  countDrafts(): Promise<number>;
}

/** Columns read for a person summary. */
type SummaryRow = Pick<
  Selectable<PersonRow>,
  'id' | 'name' | 'kind' | 'deleted_at' | 'published_at'
> & {
  activeWorkCount: number;
  version: Date;
  archivedBy: string | null;
};

/** Converts a database row into a summary. */
function toSummary(row: SummaryRow): AdminPersonSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    lifecycle: lifecycleOf(row),
    activeWorkCount: row.activeWorkCount,
    updatedAt: row.version.toISOString(),
    archivedAt: row.deleted_at?.toISOString() ?? null,
    archivedBy: row.archivedBy,
  };
}

const SUMMARY_COLUMNS = [
  'person.id',
  'person.name',
  'person.kind',
  'person.deleted_at',
  'person.published_at',
] as const;

/** Number of unarchived works crediting the person. */
const ACTIVE_WORKS_OF_PERSON = sql<number>`(
  SELECT count(DISTINCT wc.work_id) FROM work_credit wc JOIN work w ON w.id = wc.work_id
  WHERE wc.person_id = person.id AND w.deleted_at IS NULL
)`;

/** Archive guard, evaluated inside the `UPDATE`: a work crediting the person in the meantime makes it fail. */
const NO_ACTIVE_WORK_OF_PERSON = sql<boolean>`NOT EXISTS (
  SELECT 1 FROM work_credit wc JOIN work w ON w.id = wc.work_id
  WHERE wc.person_id = person.id AND w.deleted_at IS NULL
)`;

/** Creates the people administration repository. */
export function createAdminPersonRepository(db: Db): AdminPersonRepository {
  /** People matching the search text and lifecycle. */
  function filtered({ q, lifecycle }: Pick<AdminPersonListCriteria, 'q' | 'lifecycle'>) {
    let query = db.selectFrom('person').where(lifecycleCondition('person', lifecycle));
    if (q !== undefined) query = query.where(nameContains('person.name', q));
    return query;
  }

  return {
    async list(criteria) {
      const rows = await filtered(criteria)
        .leftJoin('app_user', 'app_user.id', 'person.deleted_by')
        .select(SUMMARY_COLUMNS)
        .select('app_user.handle as archivedBy')
        .select(ACTIVE_WORKS_OF_PERSON.as('activeWorkCount'))
        .select(versionOf('person').as('version'))
        .select(FILTERED_TOTAL.as('total'))
        .orderBy(DRAFTS_FIRST('person.published_at'))
        .orderBy(sql`immutable_unaccent(person.name)`)
        .orderBy('person.id')
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
      const row = await db
        .selectFrom('person')
        .leftJoin('app_user', 'app_user.id', 'person.deleted_by')
        .select(SUMMARY_COLUMNS)
        .select('app_user.handle as archivedBy')
        .select(ACTIVE_WORKS_OF_PERSON.as('activeWorkCount'))
        .select(versionOf('person').as('version'))
        .where('person.id', '=', id)
        .executeTakeFirst();
      if (!row) return null;
      const links = await db
        .selectFrom('external_link')
        .select(['kind', 'url', 'label'])
        .where('person_id', '=', id)
        .orderBy('id')
        .execute();
      return { ...toSummary(row), links };
    },

    async create({ name, kind, links, published }) {
      return db.transaction().execute(async (trx) => {
        const { id } = await trx
          .insertInto('person')
          .values({ name, kind, published_at: published ? sql<Date>`now()` : null })
          .returning('id')
          .executeTakeFirstOrThrow();
        await replaceLinks(trx, { personId: id }, links);
        return id;
      });
    },

    async update(id, { name, kind, links, published }, version) {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .updateTable('person')
          .set({
            name,
            kind,
            published_at: publishedAtOnReplace(published),
            updated_at: sql<Date>`now()`,
          })
          .where('id', '=', id)
          .where(isVersion('person', version))
          .returning('id')
          .executeTakeFirst();
        if (!row) return false;
        await replaceLinks(trx, { personId: id }, links);
        return true;
      });
    },

    async setArchived(id, archived, adminId) {
      return db.transaction().execute(async (trx) => {
        // Locked first: the guard sees a work that credited the person while this archive waited.
        if (archived) await lockRow(trx, 'person', id);
        let query = trx
          .updateTable('person')
          .set(archiveColumns(archived, adminId))
          .where('id', '=', id);
        if (archived) query = query.where(NO_ACTIVE_WORK_OF_PERSON);
        const row = await query.returning('id').executeTakeFirst();
        return row !== undefined;
      });
    },

    async deleteRecord(id) {
      return db.transaction().execute(async (trx) => {
        // Locked first: the guard sees a work that credited the person while this delete waited.
        await lockRow(trx, 'person', id);
        return deleteRecordRow(
          trx,
          'person',
          id,
          sql<boolean>`NOT EXISTS (SELECT 1 FROM work_credit wc WHERE wc.person_id = person.id)`,
        );
      });
    },

    async countDrafts() {
      return countDraftRows(db, 'person');
    },
  };
}
