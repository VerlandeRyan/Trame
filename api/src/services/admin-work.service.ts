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
import { assertNotDraft, removeRecord } from './admin-draft.js';
import { pagination, type AdminListInput, type Page } from './admin-list.js';
import { refuseReplacement } from './admin-replace.js';

/** Data accepted to create a work. */
export type AdminWorkInput = WorkDraft;

/** Data accepted to replace a work: `updatedAt` is the record version read before editing. */
export type AdminWorkReplacement = WorkDraft & { updatedAt: string };

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
  update(id: number, input: AdminWorkReplacement): Promise<AdminWorkRecord>;
  /** Readers' list entries are kept; the work only disappears from the public. */
  archive(id: number, adminId: number): Promise<AdminWorkRecord>;
  restore(id: number, adminId: number): Promise<AdminWorkRecord>;
  /** Needs the complete record and published references (`VALIDATION_ERROR`, `DRAFT_REFERENCE`). */
  publish(id: number): Promise<AdminWorkRecord>;
  /** Only a draft or archived work that no other work relates to (`NOT_REMOVABLE`, `RECORD_IN_USE`). */
  remove(id: number): Promise<void>;
  countDrafts(): Promise<number>;
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

/**
 * Fields a published work cannot do without: a format, an author, a publisher and a synopsis in
 * the original language.
 */
function publicationGaps(input: AdminWorkInput, hasFormat: boolean) {
  const missingFields = [
    !hasFormat && 'genres',
    input.credits.length === 0 && 'credits',
    input.publisherIds.length === 0 && 'publisherIds',
    !input.synopses.some((synopsis) => synopsis.language === input.originalLanguage) && 'synopses',
  ];
  return missingFields.filter(Boolean).map((path) => ({ path: [path], code: 'too_small' }));
}

/** Creates the work administration service. */
export function createAdminWorkService(repository: AdminWorkRepository): AdminWorkService {
  /** Reads a work, archived or not; throws when it does not exist. */
  async function get(id: number): Promise<AdminWorkRecord> {
    const work = await repository.find(id);
    if (!work) throw new AppError('NOT_FOUND');
    return work;
  }

  /**
   * Rejects missing or newly archived references and a work related to itself. A work that is
   * (or becomes) published also needs a format and no draft reference; a draft needs neither.
   */
  async function checkReferences(
    input: AdminWorkInput,
    isPublished: boolean,
    current?: AdminWorkRecord,
  ): Promise<void> {
    if (input.relations.some((relation) => relation.relatedWorkId === current?.id)) {
      throw new AppError('INVALID_REFERENCE', { workIds: [current?.id] });
    }
    const [{ missing, hasFormat }, archivedReferences] = await Promise.all([
      repository.lookUpReferences(input),
      repository.findArchivedReferences(input),
    ]);
    if (hasAny(missing)) throw new AppError('INVALID_REFERENCE', missing);
    if (isPublished) {
      const gaps = publicationGaps(input, hasFormat);
      if (gaps.length > 0) throw new AppError('VALIDATION_ERROR', gaps);
    }
    const archived = newlyArchived(archivedReferences, current);
    if (hasAny(archived)) throw new AppError('ARCHIVED_REFERENCE', archived);
    if (!isPublished) return;
    const drafts = await repository.findDraftReferences(input);
    if (hasAny(drafts)) throw new AppError('DRAFT_REFERENCE', drafts);
  }

  return {
    async list(input) {
      const { items, total } = await repository.list({
        q: input.q,
        scope: input.scope,
        state: input.state,
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
      await checkReferences(input, input.published);
      return get(await repository.create(input));
    },

    async update(id, input) {
      const current = await get(id);
      await checkReferences(input, !current.draft, current);
      const { updatedAt, ...draft } = input;
      if (!(await repository.update(id, draft, updatedAt))) await refuseReplacement(get, id);
      return get(id);
    },

    async archive(id, adminId) {
      const work = await get(id);
      if (work.archived) return work;
      assertNotDraft(work);
      await repository.setArchived(id, true, adminId);
      return get(id);
    },

    async restore(id, adminId) {
      await get(id);
      await repository.setArchived(id, false, adminId);
      return get(id);
    },

    async publish(id) {
      const work = await get(id);
      if (!work.draft) return work;
      await checkReferences({ ...work, published: true }, true, work);
      await repository.publish(id);
      return get(id);
    },

    remove: (id) => removeRecord(get, repository, id),

    countDrafts: () => repository.countDrafts(),
  };
}
