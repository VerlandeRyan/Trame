/** Outcome of a versioned replacement the repository refused, shared by the three administration services. */
import { AppError } from '../errors.js';

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
