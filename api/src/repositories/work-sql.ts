/** SQL building blocks of the public catalogue: visibility, displayed title, text search and summary columns. */
import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type RawBuilder,
  type SqlBool,
} from 'kysely';
import { CREDIT_ROLE_RANK, type Database } from '../db/database.js';
import { searchTerms } from '../search-terms.js';

/** `all`: every search word must match; `any`: one is enough. */
export type MatchMode = 'all' | 'any';

/**
 * Works the public can see. Every public query on works goes through here: it is the only place
 * to complete when a work can be hidden for another reason (such as a draft).
 */
export function visibleWork(eb: ExpressionBuilder<Database, 'work'>): Expression<SqlBool> {
  return eb('work.deleted_at', 'is', null);
}

/** Same condition as raw SQL, for a work table with the given alias. */
export function visibleWorkSql(alias: string): RawBuilder<boolean> {
  const column = sql.ref(alias + '.deleted_at');
  return sql<boolean>`${column} IS NULL`;
}

/**
 * Title to display for language `lang`: the `translated` then `international` title in that language,
 * otherwise the original title (also when `lang` is the original language). `alias` is the work table.
 */
export function displayTitle(alias: string, lang: string | undefined): RawBuilder<string> {
  const title = sql.ref(`${alias}.title`);
  if (lang === undefined) return sql<string>`${title}`;
  const id = sql.ref(`${alias}.id`);
  const original = sql.ref(`${alias}.original_language`);
  return sql<string>`COALESCE((
    SELECT wt.title FROM work_title wt
    WHERE wt.work_id = ${id} AND wt.language = ${lang} AND ${original} <> ${lang}
      AND wt.kind IN ('translated', 'international')
    ORDER BY CASE wt.kind WHEN 'translated' THEN 0 ELSE 1 END, wt.title
    LIMIT 1
  ), ${title})`;
}

/** The cover is only exposed when consent has been recorded. */
export const COVER_PATH = sql<string | null>`CASE WHEN work.cover_consent THEN work.cover_path END`;

/** Role ranking built from `CREDIT_ROLE_RANK` (as parameters), never hard-coded here. */
const ROLE_RANK_SQL = sql<number>`CASE wc.role ${sql.join(
  Object.entries(CREDIT_ROLE_RANK).map(([role, rank]) => sql`WHEN ${role} THEN ${rank}::int`),
  sql` `,
)} END`;

/** Author shown for a work: the most important role, then alphabetical order. */
const MAIN_AUTHOR = sql<string | null>`(
  SELECT p.name FROM work_credit wc JOIN person p ON p.id = wc.person_id
  WHERE wc.work_id = work.id AND p.deleted_at IS NULL
  ORDER BY ${ROLE_RANK_SQL}, p.name
  LIMIT 1
)`;

/** Ignores case and accents; `<%` tolerates a slight typo (trigram index). */
function textMatch(column: string, q: string, pattern: string): RawBuilder<boolean> {
  const ref = sql.ref(column);
  return sql<boolean>`(
    immutable_unaccent(${ref}) ILIKE immutable_unaccent(${pattern})
    OR immutable_unaccent(${q}) <% immutable_unaccent(${ref})
  )`;
}

/** The word is in the title, an alternative title, an author, a publisher, a format or a genre. */
function termCondition(term: string): RawBuilder<boolean> {
  const escaped = term.replace(/[\\%_]/g, String.raw`\$&`);
  const pattern = `%${escaped}%`;
  return sql<boolean>`(
    ${textMatch('work.title', term, pattern)}
    OR EXISTS (
      SELECT 1 FROM work_title wt
      WHERE wt.work_id = work.id AND ${textMatch('wt.title', term, pattern)}
    )
    OR EXISTS (
      SELECT 1 FROM work_credit wc JOIN person p ON p.id = wc.person_id
      WHERE wc.work_id = work.id AND p.deleted_at IS NULL AND ${textMatch('p.name', term, pattern)}
    )
    OR EXISTS (
      SELECT 1 FROM work_publisher wp JOIN publisher pub ON pub.id = wp.publisher_id
      WHERE wp.work_id = work.id AND pub.deleted_at IS NULL AND ${textMatch('pub.name', term, pattern)}
    )
    OR EXISTS (
      SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
      WHERE wg.work_id = work.id AND replace(g.code, '_', ' ') ILIKE ${pattern}
    )
  )`;
}

/** `all`: every word must match (e.g. a title word plus a format); `any`: a single one is enough. */
export function searchCondition(q: string, match: MatchMode): RawBuilder<boolean> {
  const conditions = searchTerms(q).map(termCondition);
  const separator = match === 'any' ? sql` OR ` : sql` AND `;
  return sql<boolean>`(${sql.join(conditions, separator)})`;
}

/** Sorted format codes of a work. */
const FORMATS = sql<string[]>`COALESCE((
  SELECT array_agg(g.code ORDER BY g.code) FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
  WHERE wg.work_id = work.id AND g.category = 'format'
), '{}')`;

/** Columns of a work summary (list cards), with the already computed displayed title. */
export function workSummaryColumns(shownTitle: RawBuilder<string>) {
  return [
    'work.id',
    shownTitle.as('title'),
    'work.title as originalTitle',
    'work.original_language as originalLanguage',
    'work.type',
    'work.status',
    FORMATS.as('formats'),
    COVER_PATH.as('coverPath'),
    MAIN_AUTHOR.as('mainAuthor'),
  ] as const;
}
