import type { SessionData } from 'express-session';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../db/database.js';
import { createSessionRepository } from '../repositories/session.repository.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';
import { SessionStore } from './store.js';

const client = new pg.Client({ connectionString });
const db = createDb(connectionString);
const repository = createSessionRepository(db);
const store = new SessionStore(repository);

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);
const sessionData = (expires: Date, userId = 1) =>
  ({ cookie: { expires, originalMaxAge: 1000 }, userId }) as never;

/** Les méthodes du store prennent un rappel : on les attend comme des promesses. */
function call<T = void>(run: (done: (err?: unknown, result?: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    run((err, result) => (err ? reject(err as Error) : resolve(result as T)));
  });
}

const read = (sid: string) => call<SessionData | null>((done) => store.get(sid, done));

const expireOf = async (sid: string): Promise<Date> =>
  (await client.query('SELECT expire FROM session WHERE sid = $1', [sid])).rows[0].expire as Date;

beforeAll(() => client.connect());
afterAll(async () => {
  await client.end();
  await db.destroy();
});
beforeEach(() => client.query('TRUNCATE session'));

describe('SessionStore', () => {
  it('enregistre puis relit une session', async () => {
    await call((done) => store.set('abc', sessionData(inDays(1)), done));
    const data = await read('abc');
    expect(data?.userId).toBe(1);
  });

  it('remplace la session existante au lieu d’en créer une seconde', async () => {
    await call((done) => store.set('abc', sessionData(inDays(1), 1), done));
    await call((done) => store.set('abc', sessionData(inDays(1), 2), done));
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(1);
    const data = await read('abc');
    expect(data?.userId).toBe(2);
  });

  it('ne renvoie rien pour une session inconnue ou expirée', async () => {
    expect(await read('inconnue')).toBeNull();
    await call((done) => store.set('vieille', sessionData(new Date(Date.now() - 1000)), done));
    expect(await read('vieille')).toBeNull();
  });

  it('supprime une session', async () => {
    await call((done) => store.set('abc', sessionData(inDays(1)), done));
    await call((done) => store.destroy('abc', done));
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
  });

  it('prolonge une session seulement si le gain dépasse un jour', async () => {
    const start = inDays(30);
    await call((done) => store.set('abc', sessionData(start), done));

    await call((done) => store.touch('abc', sessionData(new Date(start.getTime() + 60_000)), done));
    expect((await expireOf('abc')).getTime()).toBe(start.getTime());

    const later = new Date(start.getTime() + 2 * DAY_MS);
    await call((done) => store.touch('abc', sessionData(later), done));
    expect((await expireOf('abc')).getTime()).toBe(later.getTime());
  });

  it('ne prolonge pas une inscription en attente : ses 10 minutes sont fixes', async () => {
    const start = new Date(Date.now() + 10 * 60 * 1000);
    await call((done) => store.set('attente', sessionData(start), done));
    // Chaque requête recalcule « maintenant + 10 minutes » : l’écart reste sous un jour.
    const touchedLater = new Date(start.getTime() + 5 * 60 * 1000);
    await call((done) => store.touch('attente', sessionData(touchedLater), done));
    expect((await expireOf('attente')).getTime()).toBe(start.getTime());
  });
});

describe('purge des sessions expirées', () => {
  it('supprime les expirées et garde les autres', async () => {
    await call((done) => store.set('vieille', sessionData(new Date(Date.now() - 1000)), done));
    await call((done) => store.set('valide', sessionData(inDays(1)), done));
    expect(await repository.removeExpired()).toBe(1);
    const left = (await client.query('SELECT sid FROM session')).rows;
    expect(left).toEqual([{ sid: 'valide' }]);
  });
});
