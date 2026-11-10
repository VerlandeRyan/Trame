/** Business rules for administering publishers and platforms. */
import { AppError } from '../errors.js';
import type {
  AdminPublisherDraft,
  AdminPublisherRepository,
  AdminPublisherSummary,
} from '../repositories/admin-publisher.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';

/** Data accepted to create or replace a publisher. */
export type AdminPublisherInput = AdminPublisherDraft;

/** Publisher administration operations. */
export interface AdminPublisherService {
  list(input: AdminListInput): Promise<Page<AdminPublisherSummary>>;
  get(id: number): Promise<AdminPublisherSummary>;
  create(input: AdminPublisherInput): Promise<AdminPublisherSummary>;
  update(id: number, input: AdminPublisherInput): Promise<AdminPublisherSummary>;
  /** Refused while the publisher has unarchived works. */
  archive(id: number): Promise<AdminPublisherSummary>;
  restore(id: number): Promise<AdminPublisherSummary>;
}

/** Creates the publisher administration service. */
export function createAdminPublisherService(
  repository: AdminPublisherRepository,
): AdminPublisherService {
  /** Reads a publisher, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminPublisherSummary> {
    const publisher = await repository.find(id);
    if (!publisher) throw new AppError('NOT_FOUND');
    return publisher;
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
      const publisher = await get(id);
      if (publisher.archived) return publisher;
      if (!(await repository.setArchived(id, true))) {
        const { activeWorkCount } = await get(id);
        throw new AppError('PUBLISHER_HAS_WORKS', { activeWorkCount });
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
