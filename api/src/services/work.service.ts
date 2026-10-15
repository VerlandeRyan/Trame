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
  MatchMode,
  WorkFacets,
  WorkRecord,
  WorkRepository,
  WorkSort,
  WorkSummary,
} from '../repositories/work.repository.js';

/** Recherche et filtres, partagés par la liste et les compteurs. */
export interface WorkFilterInput {
  q?: string;
  /** La liste décide seule du mode ; les compteurs le reçoivent. */
  match?: MatchMode;
  type?: WorkType[];
  status?: WorkStatus[];
  format?: string[];
  genre?: string[];
  originalLanguage?: string[];
}

export interface ListWorksInput extends WorkFilterInput {
  lang?: string;
  sort?: WorkSort;
  page: number;
  pageSize: number;
}

export interface WorkPage {
  items: WorkSummary[];
  page: number;
  pageSize: number;
  total: number;
  /** Aucune œuvre ne contient tous les mots : la liste donne celles qui en ont au moins un. */
  approximate: boolean;
}

/** Une personne et l'ensemble de ses rôles sur l'œuvre. */
export interface Credit {
  personId: number;
  name: string;
  kind: PersonKind;
  roles: CreditRole[];
  /** Sites et réseaux de la personne. */
  links: { kind: ExternalLinkKind; url: string; label: string | null }[];
}

/** RG-04 : la note moyenne n'est publiée qu'à partir de ce nombre de notes. */
export const MIN_RATINGS_FOR_AVERAGE = 10;

export type WorkDetail = Omit<WorkRecord, 'credits' | 'personLinks' | 'ratingSum'> & {
  credits: Credit[];
  /** Moyenne sur une décimale ; `null` sous `MIN_RATINGS_FOR_AVERAGE` notes. */
  ratingAverage: number | null;
};

export interface WorkService {
  list(input: ListWorksInput): Promise<WorkPage>;
  facets(input: WorkFilterInput): Promise<WorkFacets>;
  /** Lève `NOT_FOUND` si l'œuvre n'existe pas ou est archivée. `lang` : langue de l'application. */
  get(id: number, lang?: string): Promise<WorkDetail>;
}

const roleRank = (role: CreditRole): number => CREDIT_ROLE_RANK[role];

/**
 * Regroupe les crédits par personne. Rôles dans l'ordre scénario, dessin, couleur, autre ;
 * personnes triées par rôle le plus important, puis par nom.
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
  const bestRank = (credit: Credit): number => Math.min(...credit.roles.map(roleRank));
  return credits.sort((a, b) => bestRank(a) - bestRank(b) || a.name.localeCompare(b.name, 'fr'));
}

function normalizeFilters({ q, ...rest }: WorkFilterInput): WorkFilterInput {
  const normalizedQuery = q?.replace(/\s+/g, ' ').trim();
  return { ...rest, q: normalizedQuery || undefined };
}

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
      // Aucune œuvre n'a tous les mots : repli sur celles qui en ont au moins un.
      if (result.total === 0 && searchTerms(criteria.q ?? '').length > 1) {
        result = await repository.search({ ...criteria, match: 'any' });
        approximate = result.total > 0;
      }
      return { items: result.items, page, pageSize, total: result.total, approximate };
    },

    facets(input) {
      return repository.facets(normalizeFilters(input));
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
