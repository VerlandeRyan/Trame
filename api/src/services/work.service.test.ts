import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import type {
  FeaturedCriteria,
  RatedCriteria,
  WorkFacetCriteria,
  WorkFacets,
  WorkRecord,
  WorkRepository,
  WorkSearchCriteria,
  WorkSummary,
} from '../repositories/work.repository.js';
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

const NO_FACETS: WorkFacets = { type: [], status: [], format: [], genre: [], originalLanguage: [] };

// Données fictives : aucun titre réel du catalogue dans les tests.
const summary: WorkSummary = {
  id: 1,
  title: 'Aube Fictive',
  originalTitle: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Autrice Inventée',
};

const NO_HOME_WORKS = {
  findFeaturedWorks: () => Promise.resolve([]),
  findTopRatedWorks: () => Promise.resolve([]),
};

/** Dépôt qui ne trouve rien ; chaque test remplace la méthode qui l'intéresse. */
const NO_REPOSITORY: WorkRepository = {
  search: () => Promise.resolve({ items: [], total: 0 }),
  facets: () => Promise.resolve(NO_FACETS),
  findById: () => Promise.resolve(undefined),
  ...NO_HOME_WORKS,
};

function serviceFor(found: WorkRecord | undefined) {
  const repository: WorkRepository = {
    search: () => Promise.resolve({ items: [], total: 0 }),
    facets: () => Promise.resolve(NO_FACETS),
    findById: () => Promise.resolve(found),
    ...NO_HOME_WORKS,
  };
  return createWorkService(repository);
}

describe('WorkService.list et facets', () => {
  function recordingRepository() {
    const calls: { search?: WorkSearchCriteria; facets?: WorkFacetCriteria } = {};
    const repository: WorkRepository = {
      search: (criteria) => {
        calls.search = criteria;
        return Promise.resolve({ items: [], total: 0 });
      },
      facets: (criteria) => {
        calls.facets = criteria;
        return Promise.resolve(NO_FACETS);
      },
      findById: () => Promise.resolve(undefined),
      ...NO_HOME_WORKS,
    };
    return { calls, service: createWorkService(repository) };
  }

  it('nettoie la recherche et convertit la page en décalage', async () => {
    const { calls, service } = recordingRepository();

    const page = await service.list({
      q: '  étoile   vagabonde ',
      originalLanguage: ['ja', 'ko'],
      sort: 'recent',
      page: 3,
      pageSize: 10,
    });

    expect(calls.search).toMatchObject({
      q: 'étoile vagabonde',
      originalLanguage: ['ja', 'ko'],
      sort: 'recent',
      limit: 10,
      offset: 20,
    });
    expect(page).toEqual({ items: [], page: 3, pageSize: 10, total: 0, approximate: false });
  });

  it('propose des résultats approchants quand aucun résultat ne contient tous les mots', async () => {
    const searches: (string | undefined)[] = [];
    const service = createWorkService({
      search: (criteria) => {
        searches.push(criteria.match);
        const found = criteria.match === 'any';
        return Promise.resolve({ items: found ? [summary] : [], total: found ? 1 : 0 });
      },
      facets: () => Promise.resolve(NO_FACETS),
      findById: () => Promise.resolve(undefined),
      ...NO_HOME_WORKS,
    });

    const page = await service.list({ q: 'aube inconnue', page: 1, pageSize: 20 });

    expect(searches).toEqual([undefined, 'any']);
    expect(page).toMatchObject({ total: 1, approximate: true });
  });

  it('ne passe pas aux approchants pour un seul mot ni quand la recherche aboutit', async () => {
    const searches: (string | undefined)[] = [];
    const service = createWorkService({
      search: (criteria) => {
        searches.push(criteria.match);
        return Promise.resolve({ items: [], total: 0 });
      },
      facets: () => Promise.resolve(NO_FACETS),
      findById: () => Promise.resolve(undefined),
      ...NO_HOME_WORKS,
    });

    const page = await service.list({ q: 'inconnu', page: 1, pageSize: 20 });

    expect(searches).toEqual([undefined]);
    expect(page.approximate).toBe(false);
  });

  it('ignore une recherche réduite à des espaces et transmet les filtres aux compteurs', async () => {
    const { calls, service } = recordingRepository();

    await service.facets({ q: '   ', type: ['series', 'oneshot'], format: ['manga'] });

    expect(calls.facets).toEqual({ q: undefined, type: ['series', 'oneshot'], format: ['manga'] });
  });
});

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

describe('WorkService.listFeaturedWorks et listTopRatedWorks', () => {
  it('transmet la fenêtre de 7 jours, le seuil de 3 ajouts et la langue', async () => {
    const calls: FeaturedCriteria[] = [];
    const service = createWorkService({
      ...NO_REPOSITORY,
      findFeaturedWorks: (criteria) => {
        calls.push(criteria);
        return Promise.resolve([{ ...summary, synopsis: 'Texte fictif.' }]);
      },
    });

    const result = await service.listFeaturedWorks('en');

    expect(calls).toEqual([{ lang: 'en', minAdditions: 3, sinceDays: 7, limit: 3 }]);
    expect(result.items).toEqual([{ ...summary, synopsis: 'Texte fictif.' }]);
  });

  it('calcule la moyenne sur une décimale et applique le seuil de notes du dépôt', async () => {
    const calls: RatedCriteria[] = [];
    const service = createWorkService({
      ...NO_REPOSITORY,
      findTopRatedWorks: (criteria) => {
        calls.push(criteria);
        return Promise.resolve([{ ...summary, ratingCount: 12, ratingSum: 85 }]);
      },
    });

    const result = await service.listTopRatedWorks();

    expect(calls).toEqual([{ lang: undefined, minRatings: MIN_RATINGS_FOR_AVERAGE, limit: 12 }]);
    expect(result.items).toEqual([{ ...summary, ratingCount: 12, ratingAverage: 7.1 }]);
  });
});
