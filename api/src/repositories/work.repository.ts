import { sql, type Expression, type ExpressionBuilder, type RawBuilder, type SqlBool } from 'kysely';
import {
  CREDIT_ROLE_RANK,
  type CreditRole,
  type Database,
  type Db,
  type ExternalLinkKind,
  type GenreCategory,
  type PersonKind,
  type PublisherKind,
  type RelationKind,
  type WorkStatus,
  type WorkType,
} from '../db/database.js';

export interface WorkSearchCriteria {
  /** Texte déjà nettoyé (espaces) et d'au moins 2 caractères. */
  q?: string;
  type?: WorkType;
  status?: WorkStatus;
  /** Code d'un format (ex. `manga`). */
  format?: string;
  /** Code d'un genre thématique (ex. `fantasy`). */
  genre?: string;
  limit: number;
  offset: number;
}

export interface WorkSummary {
  id: number;
  title: string;
  type: WorkType;
  status: WorkStatus;
  coverPath: string | null;
  mainAuthor: string | null;
}

export interface WorkSearchResult {
  items: WorkSummary[];
  total: number;
}

/** Fiche telle que lue en base : un crédit par (personne, rôle). Le service les regroupe par personne. */
export interface WorkRecord {
  id: number;
  title: string;
  type: WorkType;
  status: WorkStatus;
  synopsis: string | null;
  chapters: number | null;
  volumes: number | null;
  startedOn: string | null;
  endedOn: string | null;
  coverPath: string | null;
  alternativeTitles: string[];
  credits: { personId: number; name: string; kind: PersonKind; role: CreditRole }[];
  publishers: { id: number; name: string; kind: PublisherKind; url: string | null }[];
  /** Codes des formats (catégorie `format`), triés. */
  formats: string[];
  /** Codes des genres thématiques (catégorie `theme`), triés. */
  genres: string[];
  links: { kind: ExternalLinkKind; url: string; label: string | null }[];
  /** Un seul sens est stocké : `outgoing` = cette œuvre est la source, `incoming` = elle est la cible. */
  relations: {
    relation: RelationKind;
    direction: 'outgoing' | 'incoming';
    work: { id: number; title: string; type: WorkType };
  }[];
}

export interface WorkRepository {
  search(criteria: WorkSearchCriteria): Promise<WorkSearchResult>;
  /** Renvoie `undefined` si l'œuvre n'existe pas ou est archivée. */
  findById(id: number): Promise<WorkRecord | undefined>;
}

/** La couverture n'est exposée qu'avec l'accord enregistré (`cover_consent`). */
const COVER_PATH = sql<string | null>`CASE WHEN work.cover_consent THEN work.cover_path END`;

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

/** Œuvre dont le titre, un titre alternatif, un auteur ou un éditeur correspond à `q`. */
function searchCondition(q: string): RawBuilder<boolean> {
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  return sql<boolean>`(
    ${textMatch('work.title', q, pattern)}
    OR EXISTS (
      SELECT 1 FROM work_title wt
      WHERE wt.work_id = work.id AND ${textMatch('wt.title', q, pattern)}
    )
    OR EXISTS (
      SELECT 1 FROM work_credit wc JOIN person p ON p.id = wc.person_id
      WHERE wc.work_id = work.id AND p.deleted_at IS NULL AND ${textMatch('p.name', q, pattern)}
    )
    OR EXISTS (
      SELECT 1 FROM work_publisher wp JOIN publisher pub ON pub.id = wp.publisher_id
      WHERE wp.work_id = work.id AND pub.deleted_at IS NULL AND ${textMatch('pub.name', q, pattern)}
    )
  )`;
}

/** L'œuvre porte l'étiquette `code`, à condition qu'elle soit de la catégorie donnée. */
function hasGenre(code: string, category: GenreCategory): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
    WHERE wg.work_id = work.id AND g.code = ${code} AND g.category = ${category}
  )`;
}

function filters(criteria: WorkSearchCriteria) {
  return (eb: ExpressionBuilder<Database, 'work'>): Expression<SqlBool> => {
    const conditions: Expression<SqlBool>[] = [eb('work.deleted_at', 'is', null)];
    if (criteria.type !== undefined) conditions.push(eb('work.type', '=', criteria.type));
    if (criteria.status !== undefined) conditions.push(eb('work.status', '=', criteria.status));
    if (criteria.format !== undefined) conditions.push(hasGenre(criteria.format, 'format'));
    if (criteria.genre !== undefined) conditions.push(hasGenre(criteria.genre, 'theme'));
    if (criteria.q !== undefined) conditions.push(searchCondition(criteria.q));
    return eb.and(conditions);
  };
}

export function createWorkRepository(db: Db): WorkRepository {
  return {
    async search(criteria) {
      let listQuery = db
        .selectFrom('work')
        .select([
          'work.id',
          'work.title',
          'work.type',
          'work.status',
          COVER_PATH.as('coverPath'),
          MAIN_AUTHOR.as('mainAuthor'),
        ])
        .where(filters(criteria));
      if (criteria.q !== undefined) {
        listQuery = listQuery.orderBy(
          sql`word_similarity(immutable_unaccent(${criteria.q}), immutable_unaccent(work.title))`,
          'desc',
        );
      }

      const [items, count] = await Promise.all([
        listQuery
          .orderBy('work.title')
          .orderBy('work.id')
          .limit(criteria.limit)
          .offset(criteria.offset)
          .execute(),
        db
          .selectFrom('work')
          .select((eb) => eb.fn.countAll<number>().as('total'))
          .where(filters(criteria))
          .executeTakeFirstOrThrow(),
      ]);
      return { items, total: count.total };
    },

    async findById(id) {
      const work = await db
        .selectFrom('work')
        .select([
          'work.id',
          'work.title',
          'work.type',
          'work.status',
          'work.synopsis',
          'work.chapters',
          'work.volumes',
          'work.started_on as startedOn',
          'work.ended_on as endedOn',
          COVER_PATH.as('coverPath'),
        ])
        .where('work.id', '=', id)
        .where('work.deleted_at', 'is', null)
        .executeTakeFirst();
      if (work === undefined) return undefined;

      const [titles, credits, publishers, genres, links, outgoing, incoming] = await Promise.all([
        db.selectFrom('work_title').select('title').where('work_id', '=', id).orderBy('title').execute(),
        db
          .selectFrom('work_credit as wc')
          .innerJoin('person as p', 'p.id', 'wc.person_id')
          .select(['p.id as personId', 'p.name', 'p.kind', 'wc.role'])
          .where('wc.work_id', '=', id)
          .where('p.deleted_at', 'is', null)
          .orderBy('p.name')
          .orderBy('wc.role')
          .execute(),
        db
          .selectFrom('work_publisher as wp')
          .innerJoin('publisher as pub', 'pub.id', 'wp.publisher_id')
          .select(['pub.id', 'pub.name', 'pub.kind', 'pub.url'])
          .where('wp.work_id', '=', id)
          .where('pub.deleted_at', 'is', null)
          .orderBy('pub.name')
          .execute(),
        db
          .selectFrom('work_genre as wg')
          .innerJoin('genre as g', 'g.id', 'wg.genre_id')
          .select(['g.code', 'g.category'])
          .where('wg.work_id', '=', id)
          .orderBy('g.code')
          .execute(),
        db
          .selectFrom('external_link')
          .select(['kind', 'url', 'label'])
          .where('work_id', '=', id)
          .orderBy('kind')
          .orderBy('url')
          .execute(),
        db
          .selectFrom('work_relation as wr')
          .innerJoin('work as w', 'w.id', 'wr.related_work_id')
          .select(['wr.relation', 'w.id', 'w.title', 'w.type'])
          .where('wr.work_id', '=', id)
          .where('w.deleted_at', 'is', null)
          .orderBy('w.title')
          .execute(),
        db
          .selectFrom('work_relation as wr')
          .innerJoin('work as w', 'w.id', 'wr.work_id')
          .select(['wr.relation', 'w.id', 'w.title', 'w.type'])
          .where('wr.related_work_id', '=', id)
          .where('w.deleted_at', 'is', null)
          .orderBy('w.title')
          .execute(),
      ]);

      const toRelation =
        (direction: 'outgoing' | 'incoming') =>
        (r: { relation: RelationKind; id: number; title: string; type: WorkType }) => ({
          relation: r.relation,
          direction,
          work: { id: r.id, title: r.title, type: r.type },
        });

      return {
        ...work,
        alternativeTitles: titles.map((t) => t.title),
        credits,
        publishers,
        formats: genres.filter((g) => g.category === 'format').map((g) => g.code),
        genres: genres.filter((g) => g.category === 'theme').map((g) => g.code),
        links,
        relations: [...outgoing.map(toRelation('outgoing')), ...incoming.map(toRelation('incoming'))],
      };
    },
  };
}
