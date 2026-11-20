/** SQL fragments shared by the administration repositories: search, lifecycle, totals and derived columns. */
import { sql, type RawBuilder } from 'kysely';
import { CREDIT_ROLE_RANK, type Db } from '../db/database.js';
import { FOREIGN_KEY_VIOLATION, isPgError } from '../db/pg-errors.js';

/** The three exclusive states of a record, derived from `published_at` and `deleted_at`. */
export const LIFECYCLES = ['draft', 'published', 'archived'] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

/** List filter: one lifecycle, or `active` for the drafts and published records (not the archives). */
export const LIFECYCLE_FILTERS = ['active', ...LIFECYCLES] as const;
export type LifecycleFilter = (typeof LIFECYCLE_FILTERS)[number];

/** Lifecycle of a record read from its two dates (an archived record is always a published one). */
export function lifecycleOf(row: {
  deleted_at: Date | null;
  published_at: Date | null;
}): Lifecycle {
  if (row.deleted_at !== null) return 'archived';
  return row.published_at === null ? 'draft' : 'published';
}

/** Condition on the lifecycle columns of a table for a list filter. */
export function lifecycleCondition(
  table: CatalogueTable,
  filter: LifecycleFilter,
): RawBuilder<boolean> {
  const deletedAt = sql.ref(`${table}.deleted_at`);
  const publishedAt = sql.ref(`${table}.published_at`);
  switch (filter) {
    case 'active':
      return sql<boolean>`${deletedAt} IS NULL`;
    case 'draft':
      return sql<boolean>`${publishedAt} IS NULL`;
    case 'published':
      return sql<boolean>`${publishedAt} IS NOT NULL AND ${deletedAt} IS NULL`;
    case 'archived':
      return sql<boolean>`${deletedAt} IS NOT NULL`;
  }
}

/** Tables of the administered catalogue. */
export type CatalogueTable = 'work' | 'person' | 'publisher';

/**
 * Version of a record: `updated_at` to the millisecond, the precision of a JavaScript date
 * (Postgres keeps microseconds, which an ISO date returned by the API would lose).
 */
export const versionOf = (table: CatalogueTable) =>
  sql<Date>`date_trunc('milliseconds', ${sql.ref(table)}.updated_at)`;

/** Whether the record is still at the given version. */
export const isVersion = (table: CatalogueTable, version: string) =>
  sql<boolean>`${versionOf(table)} = ${version}::timestamptz`;

/**
 * Columns written when archiving (`true`) or restoring (`false`) a record: archive date and
 * author, and a new version only if the record was not already in that state, so repeating the
 * action does not make other editors' version stale.
 */
export const archiveColumns = (archived: boolean, adminId: number) => ({
  deleted_at: archived ? sql<Date>`now()` : null,
  deleted_by: archived ? adminId : null,
  updated_at: sql<Date>`CASE WHEN (deleted_at IS NULL) = ${archived} THEN now() ELSE updated_at END`,
});

/** Publication date written when replacing a record: set if asked and still a draft, otherwise unchanged. */
export const publishedAtOnUpdate = (published: boolean) =>
  published ? sql<Date>`COALESCE(published_at, now())` : sql<Date | null>`published_at`;

/**
 * Locks a record for update, in a statement of its own. A guarded `UPDATE` or `DELETE` run after it
 * (same transaction) takes a fresh snapshot, so its guard sees what a concurrent transaction that
 * held the record committed meanwhile; the guard alone, in one statement, would not.
 */
export async function lockRow(trx: Db, table: CatalogueTable, id: number): Promise<void> {
  await trx.selectFrom(table).select('id').where('id', '=', id).forUpdate().execute();
}

/** A record that may be deleted for good: a draft or an archive. */
export const REMOVABLE = sql<boolean>`(published_at IS NULL OR deleted_at IS NOT NULL)`;

/** Deletes a draft or archived record; false if it is published or missing. A cited one raises 23503. */
export async function deleteRecordRow(db: Db, table: CatalogueTable, id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM ${sql.table(table)}
    WHERE id = ${id} AND ${REMOVABLE}
    RETURNING id`.execute(db);
  return result.rows.length > 0;
}

/**
 * Runs a deletion and returns false when the database refuses it because another record still
 * cites the one deleted: in a transaction, it is rolled back, so nothing deleted before the refusal
 * stays deleted. The foreign keys are the single list of what cites a record.
 */
export async function falseWhenCited(run: () => Promise<boolean>): Promise<boolean> {
  try {
    return await run();
  } catch (error) {
    if (isPgError(error) && error.code === FOREIGN_KEY_VIOLATION) return false;
    throw error;
  }
}

/** Number of drafts of a table. */
export async function countDraftRows(db: Db, table: CatalogueTable): Promise<number> {
  const result = await sql<{ total: number }>`
    SELECT count(*)::int AS total FROM ${sql.table(table)} WHERE published_at IS NULL`.execute(db);
  return result.rows[0]?.total ?? 0;
}

/** Orders drafts before published records in a list. */
export const DRAFTS_FIRST = (column: string) => sql`${sql.ref(column)} IS NOT NULL`;

/** The name contains the text, ignoring case and accents. */
export function nameContains(column: string, text: string): RawBuilder<boolean> {
  const escaped = text.replace(/[\\%_]/g, String.raw`\$&`);
  const pattern = `%${escaped}%`;
  return sql<boolean>`immutable_unaccent(${sql.ref(column)}) ILIKE immutable_unaccent(${pattern})`;
}

/** Author shown for a work: the most important role, then alphabetical order. */
export const MAIN_AUTHOR_NAME = sql<string | null>`(
  SELECT p.name FROM work_credit wc JOIN person p ON p.id = wc.person_id
  WHERE wc.work_id = work.id AND p.deleted_at IS NULL
  ORDER BY CASE wc.role ${sql.join(
    Object.entries(CREDIT_ROLE_RANK).map(([role, rank]) => sql`WHEN ${role} THEN ${rank}::int`),
    sql` `,
  )} END, p.name
  LIMIT 1
)`;

/** Sorted format codes (manga, webtoon…) of a work. */
export const FORMAT_CODES = sql<string[]>`(
  SELECT COALESCE(array_agg(g.code ORDER BY g.code), '{}') FROM work_genre wg
  JOIN genre g ON g.id = wg.genre_id
  WHERE wg.work_id = work.id AND g.category = 'format'
)`;

/** Share of the record that is filled in, by quarters: synopsis, publisher, link, cover (with consent). */
export const COMPLETENESS_PERCENT = sql<number>`(
  (CASE WHEN EXISTS (SELECT 1 FROM work_synopsis s WHERE s.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN EXISTS (SELECT 1 FROM work_publisher p WHERE p.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN EXISTS (SELECT 1 FROM external_link l WHERE l.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN work.cover_path IS NOT NULL AND work.cover_consent THEN 25 ELSE 0 END)
)::int`;

/** Number of filtered records, read with each row of the page (before `LIMIT`). */
export const FILTERED_TOTAL = sql<number>`count(*) OVER()`;

/**
 * Total of a list: the one carried by the page rows, or counted separately when the page is empty
 * (beyond the last page no row carries it).
 */
export function totalOf(
  rows: { total: number }[],
  countFiltered: () => Promise<number>,
): Promise<number> {
  const [first] = rows;
  return first ? Promise.resolve(first.total) : countFiltered();
}
