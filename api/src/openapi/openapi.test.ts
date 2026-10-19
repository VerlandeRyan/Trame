import { readFileSync } from 'node:fs';
import { apiReference } from '@scalar/express-api-reference';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { ERROR_CODES } from '../errors.js';
import { createHealthRouter } from '../routes/health.routes.js';
import { createApiRouter } from '../routes/index.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';
import { API_PREFIX, buildOpenApiDocument } from './document.js';
import {
  errorSchema,
  genreListSchema,
  healthSchema,
  workDetailSchema,
  featuredListSchema,
  topRatedListSchema,
  workFacetsSchema,
  workPageSchema,
} from './schemas.js';

const seed = readFileSync(new URL('../../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);
const app = createApp({ db });
const document = buildOpenApiDocument();

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

// Les routeurs Express ne publient pas leur pile dans les types.
interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
  matchers: ((path: string) => unknown)[];
}
const stackOf = (router: unknown): Layer[] => (router as { stack: Layer[] }).stack;

/** « METHODE /chemin » de chaque route montée ; un routeur imbriqué prend le préfixe documenté qui lui correspond. */
function mountedRoutes(router: unknown, prefixes: string[], base = ''): string[] {
  return stackOf(router).flatMap((layer) => {
    if (layer.route) {
      const path = base + (layer.route.path === '/' ? '' : layer.route.path);
      return Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${path || '/'}`);
    }
    if (!layer.handle.stack) return [];
    const prefix = prefixes.find((p) => layer.matchers.some((match) => match(`${p}/x`)));
    if (prefix === undefined)
      throw new Error('Routeur monté sur un préfixe absent de la spécification');
    return mountedRoutes(layer.handle, prefixes, base + prefix);
  });
}

/** « METHODE /chemin » de chaque opération de la spécification, au format Express. */
function documentedRoutes(): string[] {
  return Object.entries(document.paths).flatMap(([path, item]) => {
    const expressPath = path.replaceAll(/\{(\w+)\}/g, ':$1');
    return Object.keys(item).map((method) => `${method.toUpperCase()} ${expressPath}`);
  });
}

describe('document OpenAPI', () => {
  it('est un document OpenAPI 3.1 servi sur /api/v1/openapi.json', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(JSON.parse(JSON.stringify(document)));
    expect(res.body.openapi).toBe('3.1.0');
  });

  it('décrit les paramètres multi-valeurs et leur valeur par défaut', () => {
    const parameters = document.paths['/api/v1/works'].get.parameters;
    const genre = parameters.find((p) => p.name === 'genre');
    expect(genre?.schema).toMatchObject({ type: 'string' });
    expect(genre?.description).toContain('virgules');
    expect(parameters.find((p) => p.name === 'pageSize')?.schema).toMatchObject({ default: 20 });
    expect(parameters.find((p) => p.name === 'q')?.required).toBe(false);
  });

  it('décrit l’identifiant en chemin comme obligatoire', () => {
    const id = document.paths['/api/v1/works/{id}'].get.parameters.find((p) => p.name === 'id');
    expect(id).toMatchObject({ in: 'path', required: true });
  });

  it('énumère exactement les codes d’erreur de ERROR_CODES', () => {
    const schema = document.components.schemas.Error as {
      properties: { code: { enum: string[] } };
    };
    expect(schema.properties.code.enum).toEqual(Object.keys(ERROR_CODES));
  });
});

describe('contrat : routes montées et spécification', () => {
  it('chaque route montée est documentée, et inversement', () => {
    const prefixes = Object.keys(document.paths)
      .filter((path) => path.startsWith(`${API_PREFIX}/`))
      .map((path) => `/${path.slice(API_PREFIX.length + 1).split('/')[0]}`)
      .filter((prefix, i, all) => all.indexOf(prefix) === i);
    const none = {} as never;
    const api = mountedRoutes(
      createApiRouter({
        authService: none,
        genreService: none,
        workService: none,
        webOrigin: 'http://localhost:3001',
        secureCookies: false,
      }),
      prefixes,
    );
    const health = mountedRoutes(createHealthRouter(none), ['/health']);
    const mounted = [
      ...api.map((r) => r.replace(' /', ` ${API_PREFIX}/`)),
      ...health.map((r) => r.replace(' /', ' /health')),
    ];
    expect(mounted.sort()).toEqual(documentedRoutes().sort());
  });
});

describe('contrat : réponses réelles et schémas', () => {
  const expectMatches = (schema: z.ZodType, body: unknown) => {
    const result = schema.safeParse(body);
    expect(result.error?.issues ?? []).toEqual([]);
  };

  it('GET /works', async () => {
    const res = await request(app).get('/api/v1/works?lang=fr');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expectMatches(workPageSchema, res.body);
  });

  it('GET /works/featured', async () => {
    const res = await request(app).get('/api/v1/works/featured?lang=fr');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expectMatches(featuredListSchema, res.body);
  });

  it('GET /works/top-rated', async () => {
    const res = await request(app).get('/api/v1/works/top-rated?lang=fr');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expectMatches(topRatedListSchema, res.body);
  });

  it('GET /works/facets', async () => {
    const res = await request(app).get('/api/v1/works/facets');
    expect(res.status).toBe(200);
    expectMatches(workFacetsSchema, res.body);
  });

  it('GET /works/:id', async () => {
    const list = await request(app).get('/api/v1/works');
    const res = await request(app).get(`/api/v1/works/${list.body.items[0].id}?lang=fr`);
    expect(res.status).toBe(200);
    expectMatches(workDetailSchema, res.body);
  });

  it('GET /genres', async () => {
    const res = await request(app).get('/api/v1/genres');
    expectMatches(genreListSchema, res.body);
  });

  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expectMatches(healthSchema, res.body);
  });

  it('erreurs 400 et 404', async () => {
    const invalid = await request(app).get('/api/v1/works?pageSize=999');
    expect(invalid.status).toBe(400);
    expectMatches(errorSchema, invalid.body);
    expect(invalid.body.details.length).toBeGreaterThan(0);

    const missing = await request(app).get('/api/v1/works/999999999');
    expect(missing.status).toBe(404);
    expectMatches(errorSchema, missing.body);
  });
});

describe('interface /docs', () => {
  it('est absente par défaut (production)', async () => {
    expect((await request(app).get('/docs')).status).toBe(404);
  });

  it('sert Scalar quand elle est fournie', async () => {
    const withDocs = createApp({ db, docs: apiReference({ url: '/api/v1/openapi.json' }) });
    const res = await request(withDocs).get('/docs');
    expect(res.status).toBe(200);
    expect(res.text).toContain('/api/v1/openapi.json');
  });
});
