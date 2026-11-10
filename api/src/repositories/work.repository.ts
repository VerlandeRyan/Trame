/** Queries behind the public catalogue: search, facet counts, home lists and the work detail. */
import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type RawBuilder,
  type SqlBool,
} from 'kysely';
import {
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
import {
  COVER_PATH,
  displayTitle,
  searchCondition,
  visibleWork,
  workSummaryColumns,
  type MatchMode,
} from './work-sql.js';

export type { MatchMode } from './work-sql.js';

/** Search text, filters, language, sort and page of a catalogue search. */
export interface WorkSearchCriteria {
  /** Text already trimmed and at least 2 characters long. */
  q?: string;
  /** `all` (default): every word must match; `any`: one is enough. */
  match?: MatchMode;
  /** Multiple values: OR, except `genre` (AND). Filters combine with each other (AND). */
  type?: WorkType[];
  status?: WorkStatus[];
  /** Format codes (e.g. `manga`). */
  format?: string[];
  /** Theme genre codes (e.g. `fantasy`). */
  genre?: string[];
  /** Original languages (ISO 639 codes, e.g. `ja`). */
  originalLanguage?: string[];
  /** Application language: selects the displayed title (falls back to the original title). */
  lang?: string;
  /** List order; without `q`, `relevance` falls back to the title. */
  sort?: WorkSort;
  limit: number;
  offset: number;
}

/** `relevance`: closeness to `q`; `title`: A→Z; `recent`: latest added first. */
export type WorkSort = 'relevance' | 'title' | 'recent';

/** Filters only: the counts ignore the page, the sort and the language. */
export type WorkFacetCriteria = Omit<WorkSearchCriteria, 'lang' | 'sort' | 'limit' | 'offset'>;

/** A work as shown on a list card. */
export interface WorkSummary {
  id: number;
  title: string;
  originalTitle: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  /** Sorted codes of the formats (`format` category). */
  formats: string[];
  coverPath: string | null;
  mainAuthor: string | null;
}

/** One page of search results with the total number of matches. */
export interface WorkSearchResult {
  items: WorkSummary[];
  total: number;
}

/** Number of works for one filter value. */
export interface FacetCount {
  code: string;
  count: number;
}

/** Works per filter value; each group ignores its own filter (except `genre`, which is AND). */
export interface WorkFacets {
  type: FacetCount[];
  status: FacetCount[];
  format: FacetCount[];
  genre: FacetCount[];
  originalLanguage: FacetCount[];
}

/** A work featured on the home page. */
export interface FeaturedWork extends WorkSummary {
  synopsis: string | null;
  /** Additions to a list within the "recent" window (0 if none). */
  recentAdditions: number;
}

/** Ranking: additions to a list over the last `sinceDays` days (zero included), then most recent works. */
export interface FeaturedCriteria {
  lang?: string;
  sinceDays: number;
  limit: number;
}

/** Raw ratings: the service computes the average. */
export interface HomeRatedWork extends WorkSummary {
  ratingCount: number;
  ratingSum: number;
}

/** Language, minimum number of ratings and size of the top-rated list. */
export interface RatedCriteria {
  lang?: string;
  minRatings: number;
  limit: number;
}

/** Work detail as read from the database: one credit per (person, role). The service groups them by person. */
export interface WorkRecord {
  id: number;
  /** Displayed title: localised title in the requested language, otherwise the original title. */
  title: string;
  originalTitle: string;
  originalLanguage: string;
  type: WorkType;
  status: WorkStatus;
  /** Synopsis in the requested language, otherwise in the original language; `null` if none. */
  synopsis: string | null;
  synopsisLanguage: string | null;
  synopsisSource: SynopsisSource | null;
  chapters: number | null;
  volumes: number | null;
  startedOn: string | null;
  endedOn: string | null;
  coverPath: string | null;
  /** Alternative titles in every language, sorted by language, kind then title. */
  alternativeTitles: { language: string; kind: TitleKind; title: string }[];
  credits: { personId: number; name: string; kind: PersonKind; role: CreditRole }[];
  /** External links of the credited people (websites, social networks), sorted by person then kind. */
  personLinks: { personId: number; kind: ExternalLinkKind; url: string; label: string | null }[];
  publishers: { id: number; name: string; kind: PublisherKind; url: string | null }[];
  /** Sorted codes of the formats (`format` category). */
  formats: string[];
  /** Sorted codes of the theme genres (`theme` category). */
  genres: string[];
  links: { kind: ExternalLinkKind; url: string; label: string | null }[];
  /** Only one direction is stored: `outgoing` = this work is the source, `incoming` = it is the target. */
  relations: {
    relation: RelationKind;
    direction: 'outgoing' | 'incoming';
    work: { id: number; title: string; type: WorkType };
  }[];
  /** Readers who have the work in their list (private profiles included). */
  memberCount: number;
  /** Number of ratings given and their sum; the average and its threshold belong to the service. */
  ratingCount: number;
  ratingSum: number;
}

/** Public catalogue queries. */
export interface WorkRepository {
  search(criteria: WorkSearchCriteria): Promise<WorkSearchResult>;
  facets(criteria: WorkFacetCriteria): Promise<WorkFacets>;
  /** Most recently added to a list first. */
  findFeaturedWorks(criteria: FeaturedCriteria): Promise<FeaturedWork[]>;
  /** Sorted by average, then by number of ratings. */
  findTopRatedWorks(criteria: RatedCriteria): Promise<HomeRatedWork[]>;
  /** Returns `undefined` if the work does not exist or is archived. */
  findById(id: number, lang?: string): Promise<WorkRecord | undefined>;
}

/** The work has one of the `codes` labels of the category. */
function hasGenre(codes: string[], category: GenreCategory): RawBuilder<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM work_genre wg JOIN genre g ON g.id = wg.genre_id
    WHERE wg.work_id = work.id AND g.code IN (${sql.join(codes)}) AND g.category = ${category}
  )`;
}

/** Synopsis in the requested language, otherwise in the original language. `''`: no language requested. */
function preferredSynopsis(lang = ''): RawBuilder<string | null> {
  return sql<string | null>`(
    SELECT s.text FROM work_synopsis s
    WHERE s.work_id = work.id AND s.language IN (${lang}, work.original_language)
    ORDER BY (s.language = ${lang}) DESC
    LIMIT 1
  )`;
}

/** Visibility, filters and search of the criteria combined into one condition. */
function filters(criteria: WorkFacetCriteria) {
  return (eb: ExpressionBuilder<Database, 'work'>): Expression<SqlBool> => {
    const conditions: Expression<SqlBool>[] = [visibleWork(eb)];
    if (criteria.type !== undefined) conditions.push(eb('work.type', 'in', criteria.type));
    if (criteria.status !== undefined) conditions.push(eb('work.status', 'in', criteria.status));
    if (criteria.originalLanguage !== undefined) {
      conditions.push(eb('work.original_language', 'in', criteria.originalLanguage));
    }
    if (criteria.format !== undefined) conditions.push(hasGenre(criteria.format, 'format'));
    // Genres: AND, one condition per chosen genre.
    for (const code of criteria.genre ?? []) conditions.push(hasGenre([code], 'theme'));
    if (criteria.q !== undefined) {
      conditions.push(searchCondition(criteria.q, criteria.match ?? 'all'));
    }
    return eb.and(conditions);
  };
}

/** Creates the public catalogue repository. */
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
      /** The criteria without the filter of the group being counted. */
      const without = (omitted: keyof WorkFacetCriteria): WorkFacetCriteria => ({
        ...criteria,
        [omitted]: undefined,
      });
      /** Counts works per value of a column. */
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
      /**
       * Counts works per genre of a category. Formats (OR): the group ignores its filter.
       * Genres (AND): it keeps it, and the count is what adding the value would give.
       */
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

    async findFeaturedWorks({ lang, sinceDays, limit }) {
      const shownTitle = displayTitle('work', lang);
      const recent = db
        .selectFrom('library_entry')
        .select(['work_id', (eb) => eb.fn.countAll<number>().as('additions')])
        .where('created_at', '>=', sql<Date>`now() - make_interval(days => ${sinceDays})`)
        .groupBy('work_id')
        .as('recent');
      const rows = await db
        .selectFrom('work')
        .leftJoin(recent, 'recent.work_id', 'work.id')
        .select([
          ...workSummaryColumns(shownTitle),
          preferredSynopsis(lang).as('synopsis'),
          sql<number>`COALESCE(recent.additions, 0)::int`.as('additions'),
        ])
        .where(visibleWork)
        .orderBy(sql`COALESCE(recent.additions, 0)`, 'desc')
        .orderBy('work.created_at', 'desc')
        .orderBy(shownTitle)
        .orderBy('work.id')
        .limit(limit)
        .execute();
      return rows.map(({ additions, ...work }) => ({ ...work, recentAdditions: additions }));
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
        .where(visibleWork)
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
        .where(visibleWork)
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

      /** Shapes a related work row with the direction of the relation. */
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

      // Requested language first, otherwise the original language.
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
