/** What the three administration services share to update a record: its type and the refusal. */
import { AppError } from '../errors.js';

/**
 * Data sent to update a record (a full replacement, `PUT`): the creation data plus `updatedAt`, the record version read
 * before editing. `published: true` publishes a draft in the same write (left out, it stays a draft).
 */
export type UpdateInput<CreateInput extends { published: boolean }> = Omit<
  CreateInput,
  'published'
> & {
  published?: boolean;
  updatedAt: string;
};

/**
 * Throws why an update wrote nothing: `NOT_FOUND` if the record is gone, otherwise
 * `STALE_RECORD` (it changed since the version that was sent was read).
 */
export async function refuseUpdate(
  get: (id: number) => Promise<unknown>,
  id: number,
): Promise<never> {
  await get(id);
  throw new AppError('STALE_RECORD');
}
