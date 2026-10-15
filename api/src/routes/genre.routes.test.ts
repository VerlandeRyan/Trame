import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const seed = readFileSync(new URL('../../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);
const app = createApp({ db });

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

describe('GET /api/v1/genres', () => {
  it('renvoie les codes avec leur catégorie, formats d’abord, sans libellé traduit', async () => {
    const res = await request(app).get('/api/v1/genres');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { code: 'bd', category: 'format' },
      { code: 'manga', category: 'format' },
      { code: 'manhwa', category: 'format' },
      { code: 'webcomic', category: 'format' },
      { code: 'webtoon', category: 'format' },
      { code: 'fantasy', category: 'theme' },
      { code: 'humor', category: 'theme' },
      { code: 'science_fiction', category: 'theme' },
    ]);
  });
});
