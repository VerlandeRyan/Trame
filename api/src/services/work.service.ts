/** Business rules of the public catalogue: search fallback, credit grouping, home lists and rating averages. */
import {
  CREDIT_ROLE_RANK,
  type CreditRole,
  type ExternalLinkKind,
  type PersonKind,
  type WorkStatus,
  type WorkType,
} from '../db/database.js';
import { AppError } from '../errors.js';
import { searchTerms } from '../search-terms.js';
import type {
  FeaturedWork,
  MatchMode,
  HomeRatedWork,
  WorkFacets,
  WorkRecord,
  WorkRepository,
  WorkSort,
  WorkSummary,
} from '../repositories/work.repository.js';

/** Search and filters, shared by the list and the facet counts. */
export interface WorkFilterInput {
  q?: string;
  /** The list decides the mode by itself; the counts receive it. */
  match?: MatchMode;
  type?: WorkType[];
  status?: WorkStatus[];
  format?: string[];
  genre?: string[];
  originalLanguage?: string[];
}

/** Search, filters, language, sort and page of the catalogue list. */
export interface ListWorksInput extends WorkFilterInput {
  lang?: string;
  sort?: WorkSort;
  page: number;
  pageSize: number;
}

/** A page of the catalogue list. */
export interface WorkPage {
  items: WorkSummary[];
  page: number;
  pageSize: number;
  total: number;
  /** No work contains every word: the list gives those that have at least one. */
  approximate: boolean;
}

/** A person and all their roles on the work. */
export interface Credit {
  personId: number;
  name: string;
  kind: PersonKind;
  roles: CreditRole[];
  /** The person's websites and social networks. */
  links: { kind: ExternalLinkKind; url: string; label: string | null }[];
}

/** The average rating is only published from this number of ratings. */
export const MIN_RATINGS_FOR_AVERAGE = 10;

/** Work detail as returned to clients: credits grouped by person and the rating average. */
export type WorkDetail = Omit<WorkRecord, 'credits' | 'personLinks' | 'ratingSum'> & {
  credits: Credit[];
  /** Average to one decimal; `null` below `MIN_RATINGS_FOR_AVERAGE` ratings. */
  ratingAverage: number | null;
};

/**
 * Home "featured": at most 3 works, ranked by additions to a list over 7 days then by recency.
 * From `FEATURED_POPULAR_MIN_ADDITIONS` additions, a work counts as popular.
 */
export const FEATURED_POPULAR_MIN_ADDITIONS = 3;
export const FEATURED_WINDOW_DAYS = 7;
export const FEATURED_LIMIT = 3;
/** Home "top rated": enough to fill one row on a large screen. */
export const HOME_TOP_RATED_LIMIT = 12;

/** A featured work with its popularity flag. */
export interface FeaturedItem extends FeaturedWork {
  /** True from `FEATURED_POPULAR_MIN_ADDITIONS` recent additions. */
  isPopular: boolean;
}

/** A top-rated work with its average. */
export interface TopRatedWork extends Omit<HomeRatedWork, 'ratingSum'> {
  /** Average to one decimal. */
  ratingAverage: number;
}

/** Public catalogue operations. */
export interface WorkService {
  list(input: ListWorksInput): Promise<WorkPage>;
  facets(input: WorkFilterInput): Promise<WorkFacets>;
  listFeaturedWorks(lang?: string): Promise<{ items: FeaturedItem[] }>;
  listTopRatedWorks(lang?: string): Promise<{ items: TopRatedWork[] }>;
  /** Throws `NOT_FOUND` if the work does not exist or is archived. `lang` is the application language. */
  get(id: number, lang?: string): Promise<WorkDetail>;
}

/** Display rank of a credit role (0 = first). */
const roleRank = (role: CreditRole): number => CREDIT_ROLE_RANK[role];

/**
 * Groups credits by person. Roles are ordered story, art, colors, other;
 * people are sorted by their most important role, then by name.
 */
function groupCredits(
  rows: WorkRecord['credits'],
  personLinks: WorkRecord['personLinks'],
): Credit[] {
  const byPerson = new Map<number, Credit>();
  for (const row of rows) {
    const existing = byPerson.get(row.personId);
    if (existing) {
      existing.roles.push(row.role);
    } else {
      const links = personLinks
        .filter((link) => link.personId === row.personId)
        .map(({ kind, url, label }) => ({ kind, url, label }));
      byPerson.set(row.personId, {
        personId: row.personId,
        name: row.name,
        kind: row.kind,
        roles: [row.role],
        links,
      });
    }
  }
  const credits = [...byPerson.values()];
  for (const credit of credits) credit.roles.sort((a, b) => roleRank(a) - roleRank(b));
  /** Rank of the person's most important role. */
  const bestRank = (credit: Credit): number => Math.min(...credit.roles.map(roleRank));
  return credits.sort((a, b) => bestRank(a) - bestRank(b) || a.name.localeCompare(b.name, 'fr'));
}

/** Collapses the whitespace of the search text; an empty search becomes none. */
function normalizeFilters({ q, ...rest }: WorkFilterInput): WorkFilterInput {
  const normalizedQuery = q?.replace(/\s+/g, ' ').trim();
  return { ...rest, q: normalizedQuery || undefined };
}

/** Creates the public catalogue service. */
export function createWorkService(repository: WorkRepository): WorkService {
  return {
    async list({ lang, sort, page, pageSize, ...filters }) {
      const criteria = {
        ...normalizeFilters(filters),
        lang,
        sort,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      let result = await repository.search(criteria);
      let approximate = false;
      // No work has every word: fall back to those that have at least one.
      if (result.total === 0 && searchTerms(criteria.q ?? '').length > 1) {
        result = await repository.search({ ...criteria, match: 'any' });
        approximate = result.total > 0;
      }
      return { items: result.items, page, pageSize, total: result.total, approximate };
    },

    facets(input) {
      return repository.facets(normalizeFilters(input));
    },

    async listFeaturedWorks(lang) {
      const works = await repository.findFeaturedWorks({
        lang,
        sinceDays: FEATURED_WINDOW_DAYS,
        limit: FEATURED_LIMIT,
      });
      return {
        items: works.map((work) => ({
          ...work,
          isPopular: work.recentAdditions >= FEATURED_POPULAR_MIN_ADDITIONS,
        })),
      };
    },

    async listTopRatedWorks(lang) {
      const rated = await repository.findTopRatedWorks({
        lang,
        minRatings: MIN_RATINGS_FOR_AVERAGE,
        limit: HOME_TOP_RATED_LIMIT,
      });
      return {
        items: rated.map(({ ratingSum, ...work }) => ({
          ...work,
          ratingAverage: Math.round((ratingSum / work.ratingCount) * 10) / 10,
        })),
      };
    },

    async get(id, lang) {
      const record = await repository.findById(id, lang);
      if (record === undefined) throw new AppError('NOT_FOUND');
      const { ratingSum, personLinks, ...rest } = record;
      const ratingAverage =
        record.ratingCount >= MIN_RATINGS_FOR_AVERAGE
          ? Math.round((ratingSum / record.ratingCount) * 10) / 10
          : null;
      return { ...rest, credits: groupCredits(record.credits, personLinks), ratingAverage };
    },
  };
}
