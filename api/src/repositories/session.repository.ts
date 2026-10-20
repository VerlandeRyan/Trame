import type { Db } from '../db/database.js';

/** Une session n'est prolongée que si l'expiration avance de plus que cela (évite une écriture par requête). */
const MIN_EXTENSION_MS = 24 * 60 * 60 * 1000;

export interface SessionRepository {
  /** Contenu d'une session non expirée, sinon `null`. */
  find(sid: string): Promise<unknown>;
  /** Crée ou remplace la session. */
  save(sid: string, content: unknown, expire: Date): Promise<void>;
  /** Repousse l'expiration d'une session existante, si le gain dépasse un jour. */
  touch(sid: string, expire: Date): Promise<void>;
  remove(sid: string): Promise<void>;
  /** Supprime les sessions expirées ; renvoie leur nombre. */
  removeExpired(): Promise<number>;
}

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
