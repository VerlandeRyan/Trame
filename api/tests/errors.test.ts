import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/database.js';
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js';
import { validate } from '../src/middleware/validate.js';
import { testDatabaseUrl as connectionString } from './helpers/test-database.js';

const db = createDb(connectionString);
afterAll(() => db.destroy());

/** Mini application : le squelette n'a encore aucune route métier à valider. */
function probeApp() {
  const app = express();
  app.use(express.json());
  app.post('/echo', validate('body', z.object({ title: z.string().min(1) })), (req, res) => {
    res.json(req.body);
  });
  app.get('/boom', () => {
    throw new Error('détail interne secret');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("format d'erreur uniforme", () => {
  it('route inconnue : 404 NOT_FOUND', async () => {
    const res = await request(createApp({ db })).get('/api/v1/inconnu');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('corps invalide : 400 VALIDATION_ERROR avec champ, code et paramètres, sans message ni valeur saisie', async () => {
    const res = await request(probeApp()).post('/echo').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual([
      { path: ['title'], code: 'too_small', origin: 'string', minimum: 1 },
    ]);
  });

  it('type incorrect : code invalid_type avec le type attendu', async () => {
    const res = await request(probeApp()).post('/echo').send({ title: 42 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ path: ['title'], code: 'invalid_type', expected: 'string' }]);
  });

  it('corps valide : transmis tel quel', async () => {
    const res = await request(probeApp()).post('/echo').send({ title: 'Ripper' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ title: 'Ripper' });
  });

  it('JSON malformé : 400 INVALID_JSON', async () => {
    const res = await request(probeApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{pas du json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('erreur inattendue : 500 INTERNAL_ERROR sans fuite de détail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(probeApp()).get('/boom');
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});
