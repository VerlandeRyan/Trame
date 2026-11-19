/** Draft rules shared by the three administration services: publish, delete, and the archive guard. */
import { AppError } from '../errors.js';

/** What the draft rules read from a record. */
interface DraftRecord {
  draft: boolean;
}

/** The repository operations the draft rules need. */
interface DraftRepository {
  publish(id: number): Promise<boolean>;
  deleteDraft(id: number): Promise<boolean>;
}

/** A draft is deleted, not archived. */
export function assertNotDraft(record: DraftRecord): void {
  if (record.draft) throw new AppError('DRAFT_NOT_ARCHIVABLE');
}

/** Deletes a draft nothing cites (`NOT_A_DRAFT` for a published record, `DRAFT_IN_USE` if cited). */
export async function removeDraft(
  get: (id: number) => Promise<DraftRecord>,
  repository: { deleteDraft(id: number): Promise<boolean> },
  id: number,
): Promise<void> {
  if (!(await get(id)).draft) throw new AppError('NOT_A_DRAFT');
  if (!(await repository.deleteDraft(id))) throw new AppError('DRAFT_IN_USE');
}

/** `publish` (no effect on a published record) and `remove` of a resource without extra publication rules. */
export function createDraftOperations<Record extends DraftRecord>(
  get: (id: number) => Promise<Record>,
  repository: DraftRepository,
) {
  return {
    async publish(id: number): Promise<Record> {
      await get(id);
      await repository.publish(id);
      return get(id);
    },

    remove: (id: number) => removeDraft(get, repository, id),
  };
}
