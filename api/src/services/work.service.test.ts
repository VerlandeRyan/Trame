import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import type { WorkRecord, WorkRepository } from '../repositories/work.repository.js';
import { createWorkService, MIN_RATINGS_FOR_AVERAGE } from './work.service.js';

// Règles métier de la fiche, sans base ni HTTP : le dépôt est un faux en mémoire.
function record(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 1,
    title: 'Œuvre fictive',
    originalTitle: 'Œuvre fictive',
    originalLanguage: 'fr',
    type: 'series',
    status: 'ongoing',
    synopsis: null,
    synopsisLanguage: null,
    synopsisSource: null,
    chapters: null,
    volumes: null,
    startedOn: null,
    endedOn: null,
    coverPath: null,
    alternativeTitles: [],
    credits: [],
    personLinks: [],
    publishers: [],
    formats: [],
    genres: [],
    links: [],
    relations: [],
    memberCount: 0,
    ratingCount: 0,
    ratingSum: 0,
    ...overrides,
  };
}

function serviceFor(found: WorkRecord | undefined) {
  const repository: WorkRepository = {
    search: () => Promise.resolve({ items: [], total: 0 }),
    findById: () => Promise.resolve(found),
  };
  return createWorkService(repository);
}

describe('WorkService.get', () => {
  it("lève NOT_FOUND quand l'œuvre n'existe pas ou est archivée", async () => {
    await expect(serviceFor(undefined).get(1)).rejects.toBeInstanceOf(AppError);
  });

  it(`ne publie pas la moyenne sous ${MIN_RATINGS_FOR_AVERAGE} notes`, async () => {
    const work = await serviceFor(record({ ratingCount: 9, ratingSum: 81 })).get(1);

    expect(work.ratingAverage).toBeNull();
    expect(work.ratingCount).toBe(9);
    expect(work).not.toHaveProperty('ratingSum');
  });

  it(`publie la moyenne dès ${MIN_RATINGS_FOR_AVERAGE} notes, arrondie à une décimale`, async () => {
    const work = await serviceFor(record({ ratingCount: 10, ratingSum: 62 })).get(1);
    expect(work.ratingAverage).toBe(6.2);

    const rounded = await serviceFor(record({ ratingCount: 12, ratingSum: 85 })).get(1);
    expect(rounded.ratingAverage).toBe(7.1);
  });

  it('regroupe les crédits par personne, rôles ordonnés, avec les liens de la personne', async () => {
    const work = await serviceFor(
      record({
        credits: [
          { personId: 2, name: 'Zoé', kind: 'person', role: 'art' },
          { personId: 1, name: 'Alex', kind: 'person', role: 'colors' },
          { personId: 2, name: 'Zoé', kind: 'person', role: 'story' },
        ],
        personLinks: [
          { personId: 2, kind: 'social', url: 'https://reseau.exemple.test/zoe', label: null },
        ],
      }),
    ).get(1);

    expect(work.credits).toEqual([
      {
        personId: 2,
        name: 'Zoé',
        kind: 'person',
        roles: ['story', 'art'],
        links: [{ kind: 'social', url: 'https://reseau.exemple.test/zoe', label: null }],
      },
      { personId: 1, name: 'Alex', kind: 'person', roles: ['colors'], links: [] },
    ]);
    expect(work).not.toHaveProperty('personLinks');
  });
});
