import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type RawBuilder,
  type SqlBool,
} from 'kysely';
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
  type SynopsisSource,
  type TitleKind,
  type WorkStatus,
  type WorkType,
} from '../db/database.js';
import { searchTerms } from '../search-terms.js';

export interface WorkSearchCriteria {
  /** Texte déjà nettoyé (espaces) et d'au moins 2 caractères. */
  q?: string;
  /** `all` (défaut) : chaque mot doit correspondre ; `any` : un seul suffit. */
  match?: MatchMode;
  /** Valeurs multiples : OU, sauf `genre` (ET). Les filtres entre eux se combinent (ET). */
  type?: WorkType[];
  status?: WorkStatus[];
  /** Codes de formats (ex. `manga`). */
  format?: string[];
  /** Codes de genres thématiques (ex. `fantasy`). */
  genre?: string[];
  /** Langues originales (codes ISO 639, ex. `ja`). */
  originalLanguage?: string[];
  /** Langue de l'application : sert à choisir le titre affiché (repli sur le titre original). */
  lang?: string;
  /** Ordre de la liste ; sans `q`, `relevance` retombe sur le titre. */
  sort?: WorkSort;
  limit: number;
  offset: number;
}

export type MatchMode = 'all' | 'any';

/** `relevance` : proximité avec `q` ; `title` : A→Z ; `recent` : dernières ajoutées d'abord. */
export type WorkSort = 'relevance' | 'title' | 'recent';

/** Filtres seuls : les compteurs ignorent la page, le tri et la langue. */
export type WorkFacetCriteria = Omit<WorkSearchCriteria, 'lang' | 'sort' | 'limit' | 'offset'>;

export interface WorkSummary {
  id: number;
  title: string;
  originalTitle: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  /** Codes des formats (catégorie `format`), triés. */
  formats: string[];
  coverPath: string | null;
  mainAuthor: string | null;
}

export interface WorkSearchResult {
  items: WorkSummary[];
  total: number;
}

export interface FacetCount {
  code: string;
  count: number;
}

/** Œuvres par valeur de filtre ; chaque groupe ignore son propre filtre (sauf `genre`, en ET). */
export interface WorkFacets {
  type: FacetCount[];
  status: FacetCount[];
  format: FacetCount[];
  genre: FacetCount[];
  originalLanguage: FacetCount[];
}

export interface FeaturedWork extends WorkSummary {
  synopsis: string | null;
  /** Ajouts à une liste dans la fenêtre « populaire » (au moins `minAdditions`). */
  recentAdditions: number;
}

/** Populaire : au moins `minAdditions` ajouts à une liste depuis `sinceDays` jours. */
export interface FeaturedCriteria {
  lang?: string;
  minAdditions: number;
  sinceDays: number;
  limit: number;
}

/** Notes brutes : la moyenne est calculée par le service. */
export interface RatedWork extends WorkSummary {
  ratingCount: number;
  ratingSum: number;
}

export interface RatedCriteria {
  lang?: string;
  minRatings: number;
  limit: number;
}

/** Fiche telle que lue en base : un crédit par (personne, rôle). Le service les regroupe par personne. */
export interface WorkRecord {
  id: number;
  /** Titre affiché : titre localisé dans la langue demandée, sinon titre original. */
  title: string;
  originalTitle: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  /** Synopsis dans la langue demandée, sinon dans la langue originale ; `null` si aucun. */
  synopsis: string | null;
  synopsisLanguage: string | null;
  synopsisSource: SynopsisSource | null;
  chapters: number | null;
  volumes: number | null;
  startedOn: string | null;
  endedOn: string | null;
  coverPath: string | null;
  /** Titres alternatifs, toutes langues, triés par langue, nature puis titre. */
  alternativeTitles: { language: string; kind: TitleKind; title: string }[];
  credits: { personId: number; name: string; kind: PersonKind; role: CreditRole }[];
  /** Liens externes des personnes créditées (sites, réseaux), triés par personne puis nature. */
  personLinks: { personId: number; kind: ExternalLinkKind; url: string; label: string | null }[];
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
  /** Lecteurs qui ont l'œuvre dans leur liste (profils privés inclus). */
  memberCount: number;
  /** Nombre de notes données et leur somme ; la moyenne et son seuil relèvent du service. */
  ratingCount: number;
  ratingSum: number;
}

export interface WorkRepository {
  search(criteria: WorkSearchCriteria): Promise<WorkSearchResult>;
  facets(criteria: WorkFacetCriteria): Promise<WorkFacets>;
  /** La plus ajoutée à une liste récemment d'abord. */
  findFeaturedWorks(criteria: FeaturedCriteria): Promise<FeaturedWork[]>;
  /** Triées par moyenne, puis par nombre de notes. */
  findTopRatedWorks(criteria: RatedCriteria): Promise<RatedWork[]>;
  /** Renvoie `undefined` si l'œuvre n'existe pas ou est archivée. */
  findById(id: number, lang?: string): Promise<WorkRecord | undefined>;
}

/**
 * Titre à afficher pour la langue `lang` : titre `translated` puis `international` de cette langue,
 * sinon titre original (aussi quand `lang` est la langue originale). `alias` : table `work`.
 */
function displayTitle(alias: string, lang: string | undefined): RawBuilder<string> {
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
function searchCondition(q: string, match: MatchMode): RawBuilder<boolean> {
  const conditions = searchTerms(q).map(termCondition);
  const separator = match === 'any' ? sql` OR ` : sql` AND `;
  return sql<boolean>`(${sql.join(conditions, separator)})`;
}

/** L'œuvre porte l'une des étiquettes `codes` de la catégorie. */
function hasGenre(codes: string[], category: GenreCategory): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
    WHERE wg.work_id = work.id AND g.code IN (${sql.join(codes)}) AND g.category = ${category}
  )`;
}

const FORMATS = sql<string[]>`COALESCE((
  SELECT array_agg(g.code ORDER BY g.code) FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
  WHERE wg.work_id = work.id AND g.category = 'format'
), '{}')`;

function workSummaryColumns(shownTitle: RawBuilder<string>) {
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

/** Synopsis dans la langue demandée, sinon dans la langue originale. `''` : aucune langue demandée. */
function preferredSynopsis(lang = ''): RawBuilder<string | null> {
  return sql<string | null>`(
    SELECT s.text FROM work_synopsis s
    WHERE s.work_id = work.id AND s.language IN (${lang}, work.original_language)
    ORDER BY (s.language = ${lang}) DESC
    LIMIT 1
  )`;
}

function filters(criteria: WorkFacetCriteria) {
  return (eb: ExpressionBuilder<Database, 'work'>): Expression<SqlBool> => {
    const conditions: Expression<SqlBool>[] = [eb('work.deleted_at', 'is', null)];
    if (criteria.type !== undefined) conditions.push(eb('work.type', 'in', criteria.type));
    if (criteria.status !== undefined) conditions.push(eb('work.status', 'in', criteria.status));
    if (criteria.originalLanguage !== undefined) {
      conditions.push(eb('work.original_language', 'in', criteria.originalLanguage));
    }
    if (criteria.format !== undefined) conditions.push(hasGenre(criteria.format, 'format'));
    // Genres : ET, une condition par genre choisi.
    for (const code of criteria.genre ?? []) conditions.push(hasGenre([code], 'theme'));
    if (criteria.q !== undefined) {
      conditions.push(searchCondition(criteria.q, criteria.match ?? 'all'));
    }
    return eb.and(conditions);
  };
}

export function createWorkRepository(db: Db): WorkRepository {
  return {
    async search(criteria) {
      const shownTitle = displayTitle('work', criteria.lang);
      let listQuery = db
        .selectFrom('work')
        .select(workSummaryColumns(shownTitle))
        .where(filters(criteria));
      const sort = criteria.sort ?? 'relevance';
      if (sort === 'recent') {
        listQuery = listQuery.orderBy('work.created_at', 'desc');
      } else if (sort === 'relevance' && criteria.q !== undefined) {
        listQuery = listQuery.orderBy(
          sql`word_similarity(immutable_unaccent(${criteria.q}), immutable_unaccent(work.title))`,
          'desc',
        );
      }

      const [items, count] = await Promise.all([
        listQuery
          .orderBy(shownTitle)
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

    async facets(criteria) {
      const without = (omitted: keyof WorkFacetCriteria): WorkFacetCriteria => ({
        ...criteria,
        [omitted]: undefined,
      });
      const countBy = (column: string, omitted: keyof WorkFacetCriteria): Promise<FacetCount[]> => {
        const code = sql<string>`${sql.ref(column)}`;
        return db
          .selectFrom('work')
          .select([code.as('code'), (eb) => eb.fn.countAll<number>().as('count')])
          .where(filters(without(omitted)))
          .groupBy(code)
          .orderBy('count', 'desc')
          .orderBy('code')
          .execute();
      };
      // Formats (OU) : le groupe ignore son filtre. Genres (ET) : il le garde, et le compteur est
      // ce que donnerait l'ajout de la valeur.
      const countByGenre = (
        category: GenreCategory,
        omitted: 'format' | undefined,
      ): Promise<FacetCount[]> =>
        db
          .selectFrom('work_genre as wg')
          .innerJoin('genre as g', 'g.id', 'wg.genre_id')
          .select(['g.code as code', (eb) => eb.fn.countAll<number>().as('count')])
          .where('g.category', '=', category)
          .where(
            'wg.work_id',
            'in',
            db
              .selectFrom('work')
              .select('work.id')
              .where(filters(omitted === undefined ? criteria : without(omitted))),
          )
          .groupBy('g.code')
          .orderBy('count', 'desc')
          .orderBy('g.code')
          .execute();

      const [type, status, originalLanguage, format, genre] = await Promise.all([
        countBy('work.type', 'type'),
        countBy('work.status', 'status'),
        countBy('work.original_language', 'originalLanguage'),
        countByGenre('format', 'format'),
        countByGenre('theme', undefined),
      ]);
      return { type, status, format, genre, originalLanguage };
    },

    async findFeaturedWorks({ lang, minAdditions, sinceDays, limit }) {
      const shownTitle = displayTitle('work', lang);
      const recent = db
        .selectFrom('library_entry')
        .select(['work_id', (eb) => eb.fn.countAll<number>().as('additions')])
        .where('created_at', '>=', sql<Date>`now() - make_interval(days => ${sinceDays})`)
        .groupBy('work_id')
        .having((eb) => eb.fn.countAll(), '>=', minAdditions)
        .as('recent');
      const rows = await db
        .selectFrom('work')
        .innerJoin(recent, 'recent.work_id', 'work.id')
        .select([
          ...workSummaryColumns(shownTitle),
          preferredSynopsis(lang).as('synopsis'),
          'recent.additions',
        ])
        .where('work.deleted_at', 'is', null)
        .orderBy('recent.additions', 'desc')
        .orderBy(shownTitle)
        .orderBy('work.id')
        .limit(limit)
        .execute();
      // `count` revient de pg en texte (bigint).
      return rows.map(({ additions, ...work }) => ({
        ...work,
        recentAdditions: Number(additions),
      }));
    },

    async findTopRatedWorks({ lang, minRatings, limit }) {
      const shownTitle = displayTitle('work', lang);
      const rated = db
        .selectFrom('library_entry')
        .select([
          'work_id',
          (eb) => eb.fn.count<number>('rating').as('ratingCount'),
          sql<number>`SUM(rating)::bigint`.as('ratingSum'),
        ])
        .where('rating', 'is not', null)
        .groupBy('work_id')
        .having((eb) => eb.fn.count('rating'), '>=', minRatings)
        .as('rated');
      return db
        .selectFrom('work')
        .innerJoin(rated, 'rated.work_id', 'work.id')
        .select([...workSummaryColumns(shownTitle), 'rated.ratingCount', 'rated.ratingSum'])
        .where('work.deleted_at', 'is', null)
        .orderBy(sql`rated."ratingSum"::numeric / rated."ratingCount"`, 'desc')
        .orderBy('rated.ratingCount', 'desc')
        .orderBy(shownTitle)
        .orderBy('work.id')
        .limit(limit)
        .execute();
    },

    async findById(id, lang) {
      const work = await db
        .selectFrom('work')
        .select([
          'work.id',
          displayTitle('work', lang).as('title'),
          'work.title as originalTitle',
          'work.original_language as originalLanguage',
          'work.type',
          'work.status',
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

      const relatedTitle = displayTitle('w', lang).as('title');
      const [
        alternativeTitles,
        synopses,
        credits,
        publishers,
        genres,
        links,
        outgoing,
        incoming,
        tracking,
      ] = await Promise.all([
        db
          .selectFrom('work_title')
          .select(['language', 'kind', 'title'])
          .where('work_id', '=', id)
          .orderBy('language')
          .orderBy('kind')
          .orderBy('title')
          .execute(),
        db
          .selectFrom('work_synopsis')
          .select(['language', 'text', 'source'])
          .where('work_id', '=', id)
          .where(
            'language',
            'in',
            lang === undefined ? [work.originalLanguage] : [lang, work.originalLanguage],
          )
          .execute(),
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
          .select(['wr.relation', 'w.id', relatedTitle, 'w.type'])
          .where('wr.work_id', '=', id)
          .where('w.deleted_at', 'is', null)
          .orderBy('w.title')
          .execute(),
        db
          .selectFrom('work_relation as wr')
          .innerJoin('work as w', 'w.id', 'wr.work_id')
          .select(['wr.relation', 'w.id', relatedTitle, 'w.type'])
          .where('wr.related_work_id', '=', id)
          .where('w.deleted_at', 'is', null)
          .orderBy('w.title')
          .execute(),
        db
          .selectFrom('library_entry')
          .select((eb) => [
            eb.fn.countAll<number>().as('memberCount'),
            eb.fn.count<number>('rating').as('ratingCount'),
            sql<number>`COALESCE(SUM(rating), 0)::bigint`.as('ratingSum'),
          ])
          .where('work_id', '=', id)
          .executeTakeFirstOrThrow(),
      ]);

      const toRelation =
        (direction: 'outgoing' | 'incoming') =>
        (r: { relation: RelationKind; id: number; title: string; type: WorkType }) => ({
          relation: r.relation,
          direction,
          work: { id: r.id, title: r.title, type: r.type },
        });

      const personIds = [...new Set(credits.map((c) => c.personId))];
      const personLinks =
        personIds.length === 0
          ? []
          : await db
              .selectFrom('external_link')
              .select(['person_id as personId', 'kind', 'url', 'label'])
              .where('person_id', 'in', personIds)
              .orderBy('person_id')
              .orderBy('kind')
              .orderBy('url')
              .execute();

      // Langue demandée d'abord, sinon langue originale (repli ADR 0007).
      const synopsis = synopses.find((s) => s.language === lang) ?? synopses[0];

      return {
        ...work,
        synopsis: synopsis?.text ?? null,
        synopsisLanguage: synopsis?.language ?? null,
        synopsisSource: synopsis?.source ?? null,
        alternativeTitles,
        credits,
        personLinks: personLinks.flatMap((l) =>
          l.personId === null ? [] : [{ ...l, personId: l.personId }],
        ),
        publishers,
        formats: genres.filter((g) => g.category === 'format').map((g) => g.code),
        genres: genres.filter((g) => g.category === 'theme').map((g) => g.code),
        links,
        relations: [
          ...outgoing.map(toRelation('outgoing')),
          ...incoming.map(toRelation('incoming')),
        ],
        memberCount: tracking.memberCount,
        ratingCount: tracking.ratingCount,
        ratingSum: tracking.ratingSum,
      };
    },
  };
}
