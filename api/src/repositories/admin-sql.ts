import { sql, type RawBuilder } from 'kysely';
import { CREDIT_ROLE_RANK } from '../db/database.js';

/** `active` : fiches publiées ; `archived` : archives seules ; `all` : les deux. */
export const ARCHIVE_SCOPES = ['active', 'archived', 'all'] as const;
export type ArchiveScope = (typeof ARCHIVE_SCOPES)[number];

/** Le nom contient le texte, sans tenir compte de la casse ni des accents. */
export function nameContains(column: string, text: string): RawBuilder<boolean> {
  const escaped = text.replace(/[\\%_]/g, String.raw`\$&`);
  const pattern = `%${escaped}%`;
  return sql<boolean>`immutable_unaccent(${sql.ref(column)}) ILIKE immutable_unaccent(${pattern})`;
}

/** Auteur à afficher d'une œuvre : le rôle le plus important, puis l'ordre alphabétique. */
export const MAIN_AUTHOR_NAME = sql<string | null>`(
  SELECT p.name FROM work_credit wc JOIN person p ON p.id = wc.person_id
  WHERE wc.work_id = work.id AND p.deleted_at IS NULL
  ORDER BY CASE wc.role ${sql.join(
    Object.entries(CREDIT_ROLE_RANK).map(([role, rank]) => sql`WHEN ${role} THEN ${rank}::int`),
    sql` `,
  )} END, p.name
  LIMIT 1
)`;

/** Codes de format (manga, webtoon…) d'une œuvre, triés. */
export const FORMAT_CODES = sql<string[]>`(
  SELECT COALESCE(array_agg(g.code ORDER BY g.code), '{}') FROM work_genre wg
  JOIN genre g ON g.id = wg.genre_id
  WHERE wg.work_id = work.id AND g.category = 'format'
)`;

/** Part de fiche renseignée, par quarts : synopsis, éditeur, lien, couverture (avec accord). */
export const COMPLETENESS_PERCENT = sql<number>`(
  (CASE WHEN EXISTS (SELECT 1 FROM work_synopsis s WHERE s.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN EXISTS (SELECT 1 FROM work_publisher p WHERE p.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN EXISTS (SELECT 1 FROM external_link l WHERE l.work_id = work.id) THEN 25 ELSE 0 END)
  + (CASE WHEN work.cover_path IS NOT NULL AND work.cover_consent THEN 25 ELSE 0 END)
)::int`;

/** Nombre de fiches filtrées, lu avec chaque ligne de la page (avant `LIMIT`). */
export const FILTERED_TOTAL = sql<number>`count(*) OVER()`;

/**
 * Total d'une liste : celui des lignes de la page, ou compté à part quand la page est vide
 * (au-delà de la dernière page, aucune ligne ne le porte).
 */
export async function totalOf(
  rows: { total: number }[],
  countFiltered: () => Promise<number>,
): Promise<number> {
  return rows[0]?.total ?? countFiltered();
}

/** Condition sur `deleted_at` pour une portée donnée ; `null` quand tout est demandé. */
export function archiveCondition(column: string, scope: ArchiveScope): RawBuilder<boolean> | null {
  if (scope === 'all') return null;
  const ref = sql.ref(column);
  return scope === 'active' ? sql<boolean>`${ref} IS NULL` : sql<boolean>`${ref} IS NOT NULL`;
}
