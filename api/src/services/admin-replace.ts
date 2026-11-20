/** What the three administration services share to replace a record: its type and the refusal. */
import { AppError } from '../errors.js';

/**
 * Data accepted to replace a record: `updatedAt` is the record version read before editing, and
 * `published: true` publishes a draft in the same write (left out, the draft stays a draft).
 */
export type Replacement<Draft extends { published: boolean }> = Omit<Draft, 'published'> & {
  published?: boolean;
  updatedAt: string;
};

/**
 * Throws why a replacement wrote nothing: `NOT_FOUND` if the record is gone, otherwise
 * `STALE_RECORD` (it changed since the version that was sent was read).
 */
export async function refuseReplacement(
  get: (id: number) => Promise<unknown>,
  id: number,
): Promise<never> {
  await get(id);
  throw new AppError('STALE_RECORD');
}
