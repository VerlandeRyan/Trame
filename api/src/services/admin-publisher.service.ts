/** Business rules for administering publishers and platforms. */
import { AppError } from '../errors.js';
import type {
  AdminPublisherDraft,
  AdminPublisherRepository,
  AdminPublisherSummary,
} from '../repositories/admin-publisher.repository.js';
import { assertNotDraft, createDraftOperations } from './admin-draft.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';
import { refuseReplacement } from './admin-replace.js';

/** Data accepted to create a publisher. */
export type AdminPublisherInput = AdminPublisherDraft;

/** Data accepted to replace a publisher: `updatedAt` is the record version read before editing. */
export type AdminPublisherReplacement = AdminPublisherDraft & { updatedAt: string };

/** Publisher administration operations. */
export interface AdminPublisherService {
  list(input: AdminListInput): Promise<Page<AdminPublisherSummary>>;
  get(id: number): Promise<AdminPublisherSummary>;
  create(input: AdminPublisherInput): Promise<AdminPublisherSummary>;
  update(id: number, input: AdminPublisherReplacement): Promise<AdminPublisherSummary>;
  /** Refused while the publisher has unarchived works. */
  archive(id: number, adminId: number): Promise<AdminPublisherSummary>;
  restore(id: number, adminId: number): Promise<AdminPublisherSummary>;
  publish(id: number): Promise<AdminPublisherSummary>;
  /** Only a draft or archived publisher no work lists (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  remove(id: number): Promise<void>;
  countDrafts(): Promise<number>;
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
        state: input.state,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      return get(await repository.create(input));
    },

    async update(id, input) {
      const { updatedAt, ...draft } = input;
      if (!(await repository.update(id, draft, updatedAt))) await refuseReplacement(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const publisher = await get(id);
      if (publisher.archived) return publisher;
      assertNotDraft(publisher);
      if (!(await repository.setArchived(id, true, adminId))) {
        const { activeWorkCount } = await get(id);
        throw new AppError('PUBLISHER_HAS_WORKS', { activeWorkCount });
      }
      return get(id);
    },

    async restore(id, adminId) {
      await get(id);
      await repository.setArchived(id, false, adminId);
      return get(id);
    },

    ...createDraftOperations(get, repository),

    countDrafts: () => repository.countDrafts(),
  };
}
