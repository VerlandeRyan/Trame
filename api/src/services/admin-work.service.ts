/** Business rules for administering works: reference checks, versioned updates and archiving. */
import type { WorkStatus, WorkType } from '../domain/catalogue-enums.js';
import { AppError } from '../errors.js';
import type {
  AdminWorkRecord,
  AdminWorkRepository,
  AdminWorkListItem,
  ArchivedReferences,
  MissingReferences,
  WorkDraft,
} from '../repositories/admin-work.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';

/** `updatedAt` is the record version read before editing; without it nothing is checked. */
export type AdminWorkInput = WorkDraft & { updatedAt?: string };

/** Sort orders of the work list. */
export const ADMIN_WORK_SORTS = [
  'title',
  'title_desc',
  'completeness',
  'completeness_desc',
] as const;
export type AdminWorkSort = (typeof ADMIN_WORK_SORTS)[number];

/** Work list: sort and filters (one value of a filter is enough; all filters apply). */
export interface AdminWorkListInput extends AdminListInput {
  sort: AdminWorkSort;
  type?: WorkType[];
  status?: WorkStatus[];
  /** Format codes. */
  format?: string[];
}

/** Work administration operations. */
export interface AdminWorkService {
  list(input: AdminWorkListInput): Promise<Page<AdminWorkListItem>>;
  get(id: number): Promise<AdminWorkRecord>;
  create(input: AdminWorkInput): Promise<AdminWorkRecord>;
  update(id: number, input: AdminWorkInput): Promise<AdminWorkRecord>;
  /** Readers' list entries are kept; the work only disappears from the public. */
  archive(id: number, adminId: number): Promise<AdminWorkRecord>;
  restore(id: number, adminId: number): Promise<AdminWorkRecord>;
}

/** Whether any reference list is non-empty. */
function hasAny(references: MissingReferences | ArchivedReferences): boolean {
  return Object.values(references).some((ids) => ids.length > 0);
}

/** Archived records the work already cites stay allowed: they are kept, not newly added. */
function newlyArchived(
  archived: ArchivedReferences,
  current?: AdminWorkRecord,
): ArchivedReferences {
  /** The identifiers that are not in the kept list. */
  const without = (ids: number[], kept: number[]) => ids.filter((id) => !kept.includes(id));
  return {
    personIds: without(archived.personIds, current?.credits.map((c) => c.personId) ?? []),
    publisherIds: without(archived.publisherIds, current?.publisherIds ?? []),
    workIds: without(archived.workIds, current?.relations.map((r) => r.relatedWorkId) ?? []),
  };
}

/** Creates the work administration service. */
export function createAdminWorkService(repository: AdminWorkRepository): AdminWorkService {
  /** Reads a work, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminWorkRecord> {
    const work = await repository.find(id);
    if (!work) throw new AppError('NOT_FOUND');
    return work;
  }

  /** Rejects missing or newly archived references, and a work related to itself. */
  async function checkReferences(input: AdminWorkInput, current?: AdminWorkRecord): Promise<void> {
    if (input.relations.some((relation) => relation.relatedWorkId === current?.id)) {
      throw new AppError('INVALID_REFERENCE', { workIds: [current?.id] });
    }
    const missing = await repository.findMissingReferences(input);
    if (hasAny(missing)) throw new AppError('INVALID_REFERENCE', missing);
    const archived = newlyArchived(await repository.findArchivedReferences(input), current);
    if (hasAny(archived)) throw new AppError('ARCHIVED_REFERENCE', archived);
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        scope: input.scope,
        sort: input.sort,
        types: input.type,
        statuses: input.status,
        formats: input.format,
        ...pagination(input),
      });
      return { items, page: input.page, pageSize: input.pageSize, total };
    },

    get,

    async create(input) {
      await checkReferences(input);
      return get(await repository.create(input));
    },

    async update(id, input) {
      await checkReferences(input, await get(id));
      const { updatedAt, ...draft } = input;
      if (!(await repository.update(id, draft, updatedAt))) throw new AppError('STALE_RECORD');
      return get(id);
    },

    async archive(id, adminId) {
      const work = await get(id);
      if (work.archived) return work;
      await repository.setArchived(id, true, adminId);
      return get(id);
    },

    async restore(id, adminId) {
      await get(id);
      await repository.setArchived(id, false, adminId);
      return get(id);
    },
  };
}
