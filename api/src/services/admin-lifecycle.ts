/** Lifecycle rules shared by the three administration services: the archive guard and deletion. */
import { AppError } from '../errors.js';
import type { Lifecycle } from '../repositories/admin-sql.js';

/** What the lifecycle rules read from a record. */
interface LifecycleRecord {
  lifecycle: Lifecycle;
}

/** A draft is deleted, not archived. */
export function assertNotDraft(record: LifecycleRecord): void {
  if (record.lifecycle === 'draft') throw new AppError('DRAFT_NOT_ARCHIVABLE');
}

/** Deletes a draft or an archived record nothing cites (`NOT_REMOVABLE` if published, `RECORD_IN_USE` if cited). */
export async function removeRecord(
  get: (id: number) => Promise<LifecycleRecord>,
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
function assertRemovable(record: LifecycleRecord): void {
  if (record.lifecycle === 'published') throw new AppError('NOT_REMOVABLE');
}
