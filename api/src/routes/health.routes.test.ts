import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const db = createDb(connectionString);
// Port volontairement fermé : la base est injoignable.
const deadDb = createDb('postgres://trame:x@127.0.0.1:1/trame');

afterAll(async () => {
  await db.destroy();
  await deadDb.destroy();
});

describe('GET /health', () => {
  it('répond 200 quand la base est joignable', async () => {
    const res = await request(createApp({ db })).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('répond 503 quand la base est injoignable', async () => {
    const res = await request(createApp({ db: deadDb })).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'down' });
  });
});
