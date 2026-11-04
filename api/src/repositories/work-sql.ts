import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type RawBuilder,
  type SqlBool,
} from 'kysely';
import { CREDIT_ROLE_RANK, type Database } from '../db/database.js';
import { searchTerms } from '../search-terms.js';

export type MatchMode = 'all' | 'any';

/**
 * Œuvres que le public peut voir. Toute requête publique sur `work` passe par là : c'est le seul
 * endroit à compléter quand une œuvre peut être cachée pour une autre raison (brouillon, #32).
 */
export function visibleWork(eb: ExpressionBuilder<Database, 'work'>): Expression<SqlBool> {
  return eb('work.deleted_at', 'is', null);
}

/** Même condition en SQL brut, pour une table `work` portant l'alias `alias`. */
export function visibleWorkSql(alias: string): RawBuilder<boolean> {
  const column = sql.ref(alias + '.deleted_at');
  return sql<boolean>`${column} IS NULL`;
}

/**
 * Titre à afficher pour la langue `lang` : titre `translated` puis `international` de cette langue,
 * sinon titre original (aussi quand `lang` est la langue originale). `alias` : table `work`.
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

/** La couverture n'est exposée qu'avec l'accord enregistré (`cover_consent`). */
export const COVER_PATH = sql<string | null>`CASE WHEN work.cover_consent THEN work.cover_path END`;

/** Classement des rôles issu de `CREDIT_ROLE_RANK` (valeurs paramétrées), jamais écrit en dur ici. */
const ROLE_RANK_SQL = sql<number>`CASE wc.role ${sql.join(
  Object.entries(CREDIT_ROLE_RANK).map(([role, rank]) => sql`WHEN ${role} THEN ${rank}::int`),
  sql` `,
)} END`;

const MAIN_AUTHOR = sql<string | null>`(
  SELECT p.name FROM work_credit wc JOIN person p ON p.id = wc.person_id
  WHERE wc.work_id = work.id AND p.deleted_at IS NULL
  ORDER BY ${ROLE_RANK_SQL}, p.name
  LIMIT 1
)`;

/** Insensible à la casse et aux accents ; `<%` tolère une faute légère (index trigramme). */
function textMatch(column: string, q: string, pattern: string): RawBuilder<boolean> {
  const ref = sql.ref(column);
  return sql<boolean>`(
    immutable_unaccent(${ref}) ILIKE immutable_unaccent(${pattern})
    OR immutable_unaccent(${q}) <% immutable_unaccent(${ref})
  )`;
}

/** Le mot est dans le titre, un titre alternatif, un auteur, un éditeur, un format ou un genre. */
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

/** `all` : chaque mot doit correspondre (« aube manga » : titre + format) ; `any` : un seul suffit. */
export function searchCondition(q: string, match: MatchMode): RawBuilder<boolean> {
  const conditions = searchTerms(q).map(termCondition);
  const separator = match === 'any' ? sql` OR ` : sql` AND `;
  return sql<boolean>`(${sql.join(conditions, separator)})`;
}

const FORMATS = sql<string[]>`COALESCE((
  SELECT array_agg(g.code ORDER BY g.code) FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
  WHERE wg.work_id = work.id AND g.category = 'format'
), '{}')`;

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
