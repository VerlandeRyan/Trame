/** Storage of web sessions. */
import type { Db } from '../db/database.js';

/** A session is only extended when the expiry moves forward by more than this (avoids a write per request). */
const MIN_EXTENSION_MS = 24 * 60 * 60 * 1000;

/** Session queries. */
export interface SessionRepository {
  /** Content of an unexpired session, otherwise `null`. */
  find(sid: string): Promise<unknown>;
  /** Creates or replaces the session. */
  save(sid: string, content: unknown, expire: Date): Promise<void>;
  /** Pushes back the expiry of an existing session, if the gain exceeds one day. */
  touch(sid: string, expire: Date): Promise<void>;
  /** Deletes a session. */
  remove(sid: string): Promise<void>;
  /** Deletes the expired sessions; returns how many. */
  removeExpired(): Promise<number>;
}

/** Creates the session repository. */
export function createSessionRepository(db: Db): SessionRepository {
  return {
    async find(sid) {
      const row = await db
        .selectFrom('session')
        .select('sess')
        .where('sid', '=', sid)
        .where('expire', '>', new Date())
        .executeTakeFirst();
      return row?.sess ?? null;
    },

    async save(sid, content, expire) {
      const sess = JSON.stringify(content);
      await db
        .insertInto('session')
        .values({ sid, sess, expire })
        .onConflict((conflict) => conflict.column('sid').doUpdateSet({ sess, expire }))
        .execute();
    },

    async touch(sid, expire) {
      const worthExtending = new Date(expire.getTime() - MIN_EXTENSION_MS);
      await db
        .updateTable('session')
        .set({ expire })
        .where('sid', '=', sid)
        .where('expire', '<', worthExtending)
        .execute();
    },

    async remove(sid) {
      await db.deleteFrom('session').where('sid', '=', sid).execute();
    },

    async removeExpired() {
      const result = await db
        .deleteFrom('session')
        .where('expire', '<=', new Date())
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
  };
}
