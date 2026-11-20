/** Business rules for administering works: reference checks, versioned updates and archiving. */
import type { WorkStatus, WorkType } from '../domain/catalogue-enums.js';
import { AppError } from '../errors.js';
import type {
  AdminWorkCreateInput,
  AdminWorkRepository,
  AdminWorkListItem,
  AdminWorkRaw,
  ArchivedReferences,
  MissingReferences,
  ReferenceReader,
} from '../repositories/admin-work.repository.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';
import { assertNotDraft, deleteRecord } from './admin-lifecycle.js';
import { refuseUpdate, type UpdateInput } from './admin-update.js';
import { publicationGaps, type PublicationGap } from './admin-publication.js';

export type { AdminWorkCreateInput };

/** A work as served for editing: the stored work plus what it still lacks to be published. */
export type AdminWorkDetail = Omit<AdminWorkRaw, 'hasFormat'> & {
  publicationGaps: PublicationGap[];
};

/** Data sent to update a work (full replacement: every field is sent, `PUT`). */
export type AdminWorkUpdateInput = UpdateInput<AdminWorkCreateInput>;

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
  get(id: number): Promise<AdminWorkDetail>;
  create(input: AdminWorkCreateInput): Promise<AdminWorkDetail>;
  /** Publishing needs the complete record and published references (`VALIDATION_ERROR`, `DRAFT_REFERENCE`). */
  update(id: number, input: AdminWorkUpdateInput): Promise<AdminWorkDetail>;
  /** Readers' list entries are kept; the work only disappears from the public. */
  archive(id: number, adminId: number): Promise<AdminWorkDetail>;
  restore(id: number, adminId: number): Promise<AdminWorkDetail>;
  /** Only a draft or archived work that no other work relates to (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  delete(id: number): Promise<void>;
  countDrafts(): Promise<number>;
}

/** Whether any reference list is non-empty. */
function hasAny(references: MissingReferences | ArchivedReferences): boolean {
  return Object.values(references).some((ids) => ids.length > 0);
}

/** Archived records the work already cites stay allowed: they are kept, not newly added. */
function newlyArchived(
  archived: ArchivedReferences,
  current?: AdminWorkDetail,
): ArchivedReferences {
  /** The identifiers that are not in the kept list. */
  const without = (ids: number[], kept: number[]) => ids.filter((id) => !kept.includes(id));
  return {
    personIds: without(archived.personIds, current?.credits.map((c) => c.personId) ?? []),
    publisherIds: without(archived.publisherIds, current?.publisherIds ?? []),
    workIds: without(archived.workIds, current?.relations.map((r) => r.relatedWorkId) ?? []),
  };
}

/**
 * Rejects missing or newly archived references and a work related to itself. A work that is
 * (or becomes) published also needs a format and no draft reference; a draft needs neither.
 * Runs inside the repository's write transaction (`references` reads through it).
 */
async function checkReferences(
  references: ReferenceReader,
  input: AdminWorkCreateInput,
  isPublished: boolean,
  current?: AdminWorkDetail,
): Promise<void> {
  if (input.relations.some((relation) => relation.relatedWorkId === current?.id)) {
    throw new AppError('INVALID_REFERENCE', { workIds: [current?.id] });
  }
  const {
    missing,
    hasFormat,
    archived: archivedReferences,
    drafts,
  } = await references.readReferences(input);
  if (hasAny(missing)) throw new AppError('INVALID_REFERENCE', missing);
  if (isPublished) {
    const gaps = publicationGaps(input, hasFormat);
    if (gaps.length > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        gaps.map((gap) => ({ path: [gap], code: 'too_small' })),
      );
    }
  }
  const archived = newlyArchived(archivedReferences, current);
  if (hasAny(archived)) throw new AppError('ARCHIVED_REFERENCE', archived);
  if (isPublished && hasAny(drafts)) throw new AppError('DRAFT_REFERENCE', drafts);
}

/** Creates the work administration service. */
export function createAdminWorkService(repository: AdminWorkRepository): AdminWorkService {
  /** Reads a work, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminWorkDetail> {
    const found = await repository.find(id);
    if (!found) throw new AppError('NOT_FOUND');
    const { hasFormat, ...work } = found;
    return { ...work, publicationGaps: publicationGaps(work, hasFormat) };
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        lifecycle: input.lifecycle,
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
      const id = await repository.create(input, (references) =>
        checkReferences(references, input, input.published),
      );
      return get(id);
    },

    async update(id, input) {
      const current = await get(id);
      // A published (or archived) work stays published: `published: false` never unpublishes it.
      const published = current.lifecycle !== 'draft' || input.published === true;
      const { updatedAt, ...rest } = input;
      const fields = { ...rest, published };
      const isWritten = await repository.update(id, fields, updatedAt, (references) =>
        checkReferences(references, fields, published, current),
      );
      if (!isWritten) await refuseUpdate(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const work = await get(id);
      if (work.lifecycle === 'archived') return work;
      assertNotDraft(work);
      await repository.setArchived(id, true, adminId);
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
