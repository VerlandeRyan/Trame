import {
  CREDIT_ROLE_RANK,
  type CreditRole,
  type ExternalLinkKind,
  type PersonKind,
  type WorkStatus,
  type WorkType,
} from '../db/database.js';
import { AppError } from '../errors.js';
import type { WorkRecord, WorkRepository, WorkSummary } from '../repositories/work.repository.js';

export interface ListWorksInput {
  q?: string;
  type?: WorkType;
  status?: WorkStatus;
  format?: string;
  genre?: string;
  lang?: string;
  page: number;
  pageSize: number;
}

export interface WorkPage {
  items: WorkSummary[];
  page: number;
  pageSize: number;
  total: number;
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
  /** Lève `NOT_FOUND` si l'œuvre n'existe pas ou est archivée. `lang` : langue de l'application. */
  get(id: number, lang?: string): Promise<WorkDetail>;
}

const roleRank = (role: CreditRole): number => CREDIT_ROLE_RANK[role];

/**
 * Regroupe les crédits par personne. Rôles dans l'ordre scénario, dessin, couleur, autre ;
 * personnes triées par rôle le plus important, puis par nom.
 */
function groupCredits(rows: WorkRecord['credits'], personLinks: WorkRecord['personLinks']): Credit[] {
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

export function createWorkService(repository: WorkRepository): WorkService {
  return {
    async list({ q, type, status, format, genre, lang, page, pageSize }) {
      const normalizedQuery = q?.replace(/\s+/g, ' ').trim();
      const { items, total } = await repository.search({
        q: normalizedQuery || undefined,
        type,
        status,
        format,
        genre,
        lang,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { items, page, pageSize, total };
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
