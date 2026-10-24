import { AppError } from '../errors.js';
import type {
  AdminPersonDraft,
  AdminPersonRecord,
  AdminPersonRepository,
  AdminPersonSummary,
} from '../repositories/admin-person.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';

export type AdminPersonInput = AdminPersonDraft;

export interface AdminPersonService {
  list(input: AdminListInput): Promise<Page<AdminPersonSummary>>;
  get(id: number): Promise<AdminPersonRecord>;
  create(input: AdminPersonInput): Promise<AdminPersonRecord>;
  update(id: number, input: AdminPersonInput): Promise<AdminPersonRecord>;
  /** Refusé tant que la personne est créditée sur une œuvre non archivée. */
  archive(id: number): Promise<AdminPersonRecord>;
  restore(id: number): Promise<AdminPersonRecord>;
}

export function createAdminPersonService(repository: AdminPersonRepository): AdminPersonService {
  async function get(id: number): Promise<AdminPersonRecord> {
    const person = await repository.find(id);
    if (!person) throw new AppError('NOT_FOUND');
    return person;
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        scope: input.scope,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      return get(await repository.create(input));
    },

    async update(id, input) {
      if (!(await repository.update(id, input))) throw new AppError('NOT_FOUND');
      return get(id);
    },

    async archive(id) {
      const person = await get(id);
      if (person.archived) return person;
      if (!(await repository.setArchived(id, true))) {
        const { activeWorkCount } = await get(id);
        throw new AppError('PERSON_HAS_WORKS', { activeWorkCount });
      }
      return get(id);
    },

    async restore(id) {
      await get(id);
      await repository.setArchived(id, false);
      return get(id);
    },
  };
}
