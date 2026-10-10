import { sql } from 'kysely';
import type { Db } from '../db/database.js';

export interface HealthRepository {
  /** Vrai si la base répond. */
  ping(): Promise<boolean>;
}

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
