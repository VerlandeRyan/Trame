/** Database liveness check. */
import { sql } from 'kysely';
import type { Db } from '../db/database.js';

/** Health queries. */
export interface HealthRepository {
  /** True when the database answers. */
  ping(): Promise<boolean>;
}

/** Creates the health repository. */
export function createHealthRepository(db: Db): HealthRepository {
  return {
    async ping() {
      try {
        await sql`SELECT 1`.execute(db);
        return true;
      } catch {
        return false;
      }
    },
  };
}
