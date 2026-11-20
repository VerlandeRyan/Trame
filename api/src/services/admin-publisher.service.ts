/** Business rules for administering publishers and platforms. */
import { AppError } from '../errors.js';
import type {
  AdminPublisherCreateInput,
  AdminPublisherListItem,
  AdminPublisherRepository,
} from '../repositories/admin-publisher.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';
import { assertNotDraft, deleteRecord } from './admin-lifecycle.js';
import { refuseUpdate, type UpdateInput } from './admin-update.js';

export type { AdminPublisherCreateInput };

/** Data sent to update a publisher (full replacement: every field is sent, `PUT`). */
export type AdminPublisherUpdateInput = UpdateInput<AdminPublisherCreateInput>;

/** Publisher administration operations. */
export interface AdminPublisherService {
  list(input: AdminListInput): Promise<Page<AdminPublisherListItem>>;
  get(id: number): Promise<AdminPublisherListItem>;
  create(input: AdminPublisherCreateInput): Promise<AdminPublisherListItem>;
  update(id: number, input: AdminPublisherUpdateInput): Promise<AdminPublisherListItem>;
  /** Refused while the publisher has unarchived works. */
  archive(id: number, adminId: number): Promise<AdminPublisherListItem>;
  restore(id: number, adminId: number): Promise<AdminPublisherListItem>;
  /** Only a draft or archived publisher no work lists (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  delete(id: number): Promise<void>;
  countDrafts(): Promise<number>;
}

/** Creates the publisher administration service. */
export function createAdminPublisherService(
  repository: AdminPublisherRepository,
): AdminPublisherService {
  /** Reads a publisher, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminPublisherListItem> {
    const publisher = await repository.find(id);
    if (!publisher) throw new AppError('NOT_FOUND');
    return publisher;
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        lifecycle: input.lifecycle,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      return get(await repository.create(input));
    },

    async update(id, input) {
      const { updatedAt, published, ...rest } = input;
      const fields = { ...rest, published: published === true };
      if (!(await repository.update(id, fields, updatedAt))) await refuseUpdate(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const publisher = await get(id);
      if (publisher.lifecycle === 'archived') return publisher;
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

    delete: (id) => deleteRecord(get, repository, id),

    countDrafts: () => repository.countDrafts(),
  };
}
