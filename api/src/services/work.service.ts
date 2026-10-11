import {
  CREDIT_ROLE_RANK,
  type CreditRole,
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
  genre?: string;
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
}

export type WorkDetail = Omit<WorkRecord, 'credits'> & { credits: Credit[] };

export interface WorkService {
  list(input: ListWorksInput): Promise<WorkPage>;
  /** Lève `NOT_FOUND` si l'œuvre n'existe pas ou est archivée. */
  get(id: number): Promise<WorkDetail>;
}

const roleRank = (role: CreditRole): number => CREDIT_ROLE_RANK[role];

/**
 * Regroupe les crédits par personne. Rôles dans l'ordre scénario, dessin, couleur, autre ;
 * personnes triées par rôle le plus important, puis par nom.
 */
function groupCredits(rows: WorkRecord['credits']): Credit[] {
  const byPerson = new Map<number, Credit>();
  for (const row of rows) {
    const existing = byPerson.get(row.personId);
    if (existing) {
      existing.roles.push(row.role);
    } else {
      byPerson.set(row.personId, { personId: row.personId, name: row.name, kind: row.kind, roles: [row.role] });
    }
  }
  const credits = [...byPerson.values()];
  for (const credit of credits) credit.roles.sort((a, b) => roleRank(a) - roleRank(b));
  const bestRank = (credit: Credit): number => Math.min(...credit.roles.map(roleRank));
  return credits.sort((a, b) => bestRank(a) - bestRank(b) || a.name.localeCompare(b.name, 'fr'));
}

export function createWorkService(repository: WorkRepository): WorkService {
  return {
    async list({ q, type, status, genre, page, pageSize }) {
      const normalizedQuery = q?.replace(/\s+/g, ' ').trim();
      const { items, total } = await repository.search({
        q: normalizedQuery ? normalizedQuery : undefined,
        type,
        status,
        genre,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { items, page, pageSize, total };
    },

    async get(id) {
      const record = await repository.findById(id);
      if (record === undefined) throw new AppError('NOT_FOUND');
      return { ...record, credits: groupCredits(record.credits) };
    },
  };
}
