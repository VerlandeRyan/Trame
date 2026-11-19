/** SQL fragments shared by the administration repositories: search, archive scope, totals and derived columns. */
import { sql, type RawBuilder } from 'kysely';
import { CREDIT_ROLE_RANK, type Db } from '../db/database.js';

/** `active`: published records; `archived`: archives only; `all`: both. */
export const ARCHIVE_SCOPES = ['active', 'archived', 'all'] as const;
export type ArchiveScope = (typeof ARCHIVE_SCOPES)[number];

/** `draft`: not yet published; `published`: published (archived or not); `all`: both. */
export const PUBLICATION_STATES = ['all', 'draft', 'published'] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

/** Publication condition on a column for a given state; `null` when everything is requested. */
export function publicationCondition(
  column: string,
  state: PublicationState,
): RawBuilder<boolean> | null {
  if (state === 'all') return null;
  const ref = sql.ref(column);
  return state === 'draft' ? sql<boolean>`${ref} IS NULL` : sql<boolean>`${ref} IS NOT NULL`;
}

/** Tables of the administered catalogue. */
export type CatalogueTable = 'work' | 'person' | 'publisher';

/**
 * Publishes a record (no effect on a published one); false if it does not exist. `touchVersion`
 * also moves the version of tables that have one.
 */
export async function publishRow(
  db: Db,
  table: CatalogueTable,
  id: number,
  touchVersion = false,
): Promise<boolean> {
  const version = touchVersion ? sql`, updated_at = now()` : sql``;
  const result = await sql`
    UPDATE ${sql.table(table)} SET published_at = COALESCE(published_at, now())${version}
    WHERE id = ${id} RETURNING id`.execute(db);
  return result.rows.length > 0;
}

/** A record that may be deleted for good: a draft or an archive. */
export const REMOVABLE = sql<boolean>`(published_at IS NULL OR deleted_at IS NOT NULL)`;

/** Deletes a draft or archived record that `notCited` lets go; false if it is published, cited or missing. */
export async function deleteRecordRow(
  db: Db,
  table: CatalogueTable,
  id: number,
  notCited: RawBuilder<boolean>,
): Promise<boolean> {
  const result = await sql`
    DELETE FROM ${sql.table(table)}
    WHERE id = ${id} AND ${REMOVABLE} AND ${notCited}
    RETURNING id`.execute(db);
  return result.rows.length > 0;
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

/** Archive condition on a column for a given scope; `null` when everything is requested. */
export function archiveCondition(column: string, scope: ArchiveScope): RawBuilder<boolean> | null {
  if (scope === 'all') return null;
  const ref = sql.ref(column);
  return scope === 'active' ? sql<boolean>`${ref} IS NULL` : sql<boolean>`${ref} IS NOT NULL`;
}
