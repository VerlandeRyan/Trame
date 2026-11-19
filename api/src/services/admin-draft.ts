/** Draft rules shared by the three administration services: publish, delete, and the archive guard. */
import { AppError } from '../errors.js';

/** What the draft rules read from a record. */
interface DraftRecord {
  draft: boolean;
}

/** The repository operations the draft rules need. */
interface DraftRepository {
  publish(id: number): Promise<boolean>;
  deleteRecord(id: number): Promise<boolean>;
}

/** A draft is deleted, not archived. */
export function assertNotDraft(record: DraftRecord): void {
  if (record.draft) throw new AppError('DRAFT_NOT_ARCHIVABLE');
}

/** Deletes a draft or an archived record nothing cites (`NOT_REMOVABLE` if published, `RECORD_IN_USE` if cited). */
export async function removeRecord(
  get: (id: number) => Promise<DraftRecord & { archived: boolean }>,
  repository: { deleteRecord(id: number): Promise<boolean> },
  id: number,
): Promise<void> {
  assertRemovable(await get(id));
  if (await repository.deleteRecord(id)) return;
  // The guarded DELETE also fails when the record was restored, published or deleted since the read.
  assertRemovable(await get(id));
  throw new AppError('RECORD_IN_USE');
}

/** Throws `NOT_REMOVABLE` for a published record that is not archived. */
function assertRemovable(record: DraftRecord & { archived: boolean }): void {
  if (!record.draft && !record.archived) throw new AppError('NOT_REMOVABLE');
}

/** `publish` (no effect on a published record) and `remove` of a resource without extra publication rules. */
export function createDraftOperations<Record extends DraftRecord & { archived: boolean }>(
  get: (id: number) => Promise<Record>,
  repository: DraftRepository,
) {
  return {
    async publish(id: number): Promise<Record> {
      await get(id);
      await repository.publish(id);
      return get(id);
    },

    remove: (id: number) => removeRecord(get, repository, id),
  };
}
