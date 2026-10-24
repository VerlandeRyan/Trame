import { sql } from 'kysely';
import type { Db, PublisherKind } from '../db/database.js';
import {
  archiveCondition,
  FILTERED_TOTAL,
  nameContains,
  totalOf,
  type ArchiveScope,
} from './admin-sql.js';

export interface AdminPublisherDraft {
  name: string;
  kind: PublisherKind;
  url: string | null;
}

export interface AdminPublisherSummary extends AdminPublisherDraft {
  id: number;
  archived: boolean;
  /** Œuvres non archivées publiées par cet éditeur ou cette plateforme. */
  activeWorkCount: number;
}

export interface AdminPublisherListCriteria {
  q?: string;
  scope: ArchiveScope;
  limit: number;
  offset: number;
}

export interface AdminPublisherRepository {
  list(
    criteria: AdminPublisherListCriteria,
  ): Promise<{ items: AdminPublisherSummary[]; total: number }>;
  find(id: number): Promise<AdminPublisherSummary | null>;
  create(draft: AdminPublisherDraft): Promise<number>;
  /** Faux si l'éditeur n'existe pas. */
  update(id: number, draft: AdminPublisherDraft): Promise<boolean>;
  /** Faux si l'éditeur n'existe pas, ou, pour un archivage, si une œuvre non archivée le cite. */
  setArchived(id: number, archived: boolean): Promise<boolean>;
}

interface SummaryRow {
  id: number;
  name: string;
  kind: PublisherKind;
  url: string | null;
  deleted_at: Date | null;
  activeWorkCount: number;
}

const ACTIVE_WORKS_OF_PUBLISHER = sql<number>`(
  SELECT count(*) FROM work_publisher wp JOIN work w ON w.id = wp.work_id
  WHERE wp.publisher_id = publisher.id AND w.deleted_at IS NULL
)`;

/** Garde de l'archivage, évaluée dans l'`UPDATE` : une œuvre ajoutée entre-temps le fait échouer. */
const NO_ACTIVE_WORK_OF_PUBLISHER = sql<boolean>`NOT EXISTS (
  SELECT 1 FROM work_publisher wp JOIN work w ON w.id = wp.work_id
  WHERE wp.publisher_id = publisher.id AND w.deleted_at IS NULL
)`;

function toSummary(row: SummaryRow): AdminPublisherSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    archived: row.deleted_at !== null,
    activeWorkCount: row.activeWorkCount,
  };
}

export function createAdminPublisherRepository(db: Db): AdminPublisherRepository {
  function filtered({ q, scope }: Pick<AdminPublisherListCriteria, 'q' | 'scope'>) {
    let query = db.selectFrom('publisher');
    const archive = archiveCondition('publisher.deleted_at', scope);
    if (archive) query = query.where(archive);
    if (q !== undefined) query = query.where(nameContains('publisher.name', q));
    return query;
  }

  function selectSummaries(query: ReturnType<typeof filtered>) {
    return query
      .select(['publisher.id', 'publisher.name', 'publisher.kind', 'publisher.url'])
      .select(['publisher.deleted_at'])
      .select(ACTIVE_WORKS_OF_PUBLISHER.as('activeWorkCount'));
  }

  return {
    async list(criteria) {
      const rows = await selectSummaries(filtered(criteria))
        .select(FILTERED_TOTAL.as('total'))
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
      const row = await selectSummaries(filtered({ scope: 'all' }))
        .where('publisher.id', '=', id)
        .executeTakeFirst();
      return row ? toSummary(row) : null;
    },

    async create({ name, kind, url }) {
      const { id } = await db
        .insertInto('publisher')
        .values({ name, kind, url })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    async update(id, { name, kind, url }) {
      const row = await db
        .updateTable('publisher')
        .set({ name, kind, url })
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },

    async setArchived(id, archived) {
      let query = db
        .updateTable('publisher')
        .set({ deleted_at: archived ? sql<Date>`now()` : null })
        .where('id', '=', id);
      if (archived) query = query.where(NO_ACTIVE_WORK_OF_PUBLISHER);
      const row = await query.returning('id').executeTakeFirst();
      return row !== undefined;
    },
  };
}
