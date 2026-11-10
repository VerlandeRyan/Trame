/** Queries for administering people (creators): list, read, write and archive. */
import { sql, type Selectable } from 'kysely';
import type { Db, PersonKind, PersonRow } from '../db/database.js';
import {
  archiveCondition,
  FILTERED_TOTAL,
  nameContains,
  totalOf,
  type ArchiveScope,
} from './admin-sql.js';
import { replaceLinks, type ExternalLinkRecord } from './external-link.repository.js';

/** Data written when creating or replacing a person. */
export interface AdminPersonDraft {
  name: string;
  kind: PersonKind;
  links: ExternalLinkRecord[];
}

/** A person as shown in lists. */
export interface AdminPersonSummary {
  id: number;
  name: string;
  kind: PersonKind;
  archived: boolean;
  /** Unarchived works crediting the person. */
  activeWorkCount: number;
}

/** A person with their links. */
export interface AdminPersonRecord extends AdminPersonSummary {
  links: ExternalLinkRecord[];
}

/** Search, scope and page of a people list. */
export interface AdminPersonListCriteria {
  q?: string;
  scope: ArchiveScope;
  limit: number;
  offset: number;
}

/** People administration queries. */
export interface AdminPersonRepository {
  list(criteria: AdminPersonListCriteria): Promise<{ items: AdminPersonSummary[]; total: number }>;
  find(id: number): Promise<AdminPersonRecord | null>;
  create(draft: AdminPersonDraft): Promise<number>;
  /** False if the person does not exist. */
  update(id: number, draft: AdminPersonDraft): Promise<boolean>;
  /** False if the person does not exist, or, when archiving, if an unarchived work credits them. */
  setArchived(id: number, archived: boolean): Promise<boolean>;
}

/** Columns read for a person summary. */
type SummaryRow = Pick<Selectable<PersonRow>, 'id' | 'name' | 'kind' | 'deleted_at'> & {
  activeWorkCount: number;
};

/** Converts a database row into a summary. */
function toSummary(row: SummaryRow): AdminPersonSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    archived: row.deleted_at !== null,
    activeWorkCount: row.activeWorkCount,
  };
}

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
  /** People matching the search text and archive scope. */
  function filtered({ q, scope }: Pick<AdminPersonListCriteria, 'q' | 'scope'>) {
    let query = db.selectFrom('person');
    const archive = archiveCondition('person.deleted_at', scope);
    if (archive) query = query.where(archive);
    if (q !== undefined) query = query.where(nameContains('person.name', q));
    return query;
  }

  return {
    async list(criteria) {
      const rows = await filtered(criteria)
        .select(['person.id', 'person.name', 'person.kind', 'person.deleted_at'])
        .select(ACTIVE_WORKS_OF_PERSON.as('activeWorkCount'))
        .select(FILTERED_TOTAL.as('total'))
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
        .select(['person.id', 'person.name', 'person.kind', 'person.deleted_at'])
        .select(ACTIVE_WORKS_OF_PERSON.as('activeWorkCount'))
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

    async create({ name, kind, links }) {
      return db.transaction().execute(async (trx) => {
        const { id } = await trx
          .insertInto('person')
          .values({ name, kind })
          .returning('id')
          .executeTakeFirstOrThrow();
        await replaceLinks(trx, { personId: id }, links);
        return id;
      });
    },

    async update(id, { name, kind, links }) {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .updateTable('person')
          .set({ name, kind })
          .where('id', '=', id)
          .returning('id')
          .executeTakeFirst();
        if (!row) return false;
        await replaceLinks(trx, { personId: id }, links);
        return true;
      });
    },

    async setArchived(id, archived) {
      let query = db
        .updateTable('person')
        .set({ deleted_at: archived ? sql<Date>`now()` : null })
        .where('id', '=', id);
      if (archived) query = query.where(NO_ACTIVE_WORK_OF_PERSON);
      const row = await query.returning('id').executeTakeFirst();
      return row !== undefined;
    },
  };
}
