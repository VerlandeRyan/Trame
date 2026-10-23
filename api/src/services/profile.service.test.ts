import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { zeroStatusCounts } from '../repositories/library.repository.js';
import type {
  ProfileAccount,
  ProfileFigures,
  ProfileRepository,
} from '../repositories/profile.repository.js';
import type { AuthUser } from '../repositories/user.repository.js';
import type { WorkSummary } from '../repositories/work.repository.js';
import type { LibraryPage, LibraryService, ListEntriesInput } from './library.service.js';
import {
  createProfileService,
  PROFILE_RECENT_UPDATES_LIMIT,
  PROFILE_TOP_RATED_LIMIT,
} from './profile.service.js';

// Règles d'accès et calculs du profil, sans base ni HTTP : dépôt et liste de lecture en mémoire.
const OWNER_ID = 7;
const owner: AuthUser = { id: OWNER_ID, handle: 'Lectrice', role: 'user' };
const stranger: AuthUser = { id: 99, handle: 'Autre', role: 'user' };

function account(overrides: Partial<ProfileAccount> = {}): ProfileAccount {
  return {
    id: OWNER_ID,
    handle: 'Lectrice',
    visibility: 'public',
    memberSince: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  };
}

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

const LIST_INPUT: ListEntriesInput = { sort: 'updated', page: 1, pageSize: 50 };

/** Faux dépôt : `calls` garde les lectures faites, pour vérifier ce qu'un tiers ne déclenche pas. */
function fakeProfiles(
  found: ProfileAccount | null,
  figures: Partial<ProfileFigures> = {},
): ProfileRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    findByHandle: () => Promise.resolve(found),
    figures: () => {
      calls.push('figures');
      return Promise.resolve({
        statusCounts: zeroStatusCounts(),
        chaptersRead: 0,
        volumesRead: 0,
        ratingSum: 0,
        ratingCount: 0,
        ...figures,
      });
    },
    recentUpdates: (_userId, _lang, limit) => {
      calls.push(`recentUpdates:${limit}`);
      return Promise.resolve([
        {
          work: summary,
          entry: {
            status: 'reading',
            chaptersRead: 3,
            volumesRead: 0,
            rating: null,
            startedOn: null,
            finishedOn: null,
          },
          updatedAt: new Date('2026-10-20T08:00:00Z'),
        },
      ]);
    },
    topRated: (_userId, _lang, limit) => {
      calls.push(`topRated:${limit}`);
      return Promise.resolve([]);
    },
    setVisibility: (userId, visibility) => {
      calls.push(`setVisibility:${userId}:${visibility}`);
      return Promise.resolve();
    },
  };
}

function fakeLibrary(): LibraryService & { listedFor: number[] } {
  const listedFor: number[] = [];
  const page: LibraryPage = {
    items: [],
    statusCounts: zeroStatusCounts(),
    totals: { chaptersRead: 0, volumesRead: 0 },
    page: 1,
    pageSize: 50,
    total: 0,
  };
  return {
    listedFor,
    getEntry: () => Promise.resolve(null),
    saveEntry: () => Promise.reject(new Error('non utilisé')),
    removeEntry: () => Promise.resolve(),
    listEntries: (userId) => {
      listedFor.push(userId);
      return Promise.resolve(page);
    },
  };
}

describe('ProfileService.get', () => {
  it('lève NOT_FOUND pour un pseudo inconnu', async () => {
    const service = createProfileService({ profiles: fakeProfiles(null), library: fakeLibrary() });

    await expect(service.get('personne', undefined, undefined)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('montre un profil public à un visiteur, sans le dire propriétaire', async () => {
    const profiles = fakeProfiles(account(), {
      statusCounts: { ...zeroStatusCounts(), reading: 2, completed: 1 },
      chaptersRead: 40,
      volumesRead: 3,
      ratingSum: 26,
      ratingCount: 3,
    });
    const service = createProfileService({ profiles, library: fakeLibrary() });

    const profile = await service.get('lectrice', undefined, 'fr');

    expect(profile).toMatchObject({ handle: 'Lectrice', visibility: 'public', isOwner: false });
    expect(profile.details?.memberSince).toBe('2026-10-01T10:00:00.000Z');
    expect(profile.details?.stats).toEqual({
      worksFollowed: 3,
      ratingAverage: 8.7,
      statusCounts: { ...zeroStatusCounts(), reading: 2, completed: 1 },
      chaptersRead: 40,
      volumesRead: 3,
    });
    expect(profile.details?.recentUpdates[0]?.updatedAt).toBe('2026-10-20T08:00:00.000Z');
    expect(profiles.calls).toContain(`recentUpdates:${PROFILE_RECENT_UPDATES_LIMIT}`);
    expect(profiles.calls).toContain(`topRated:${PROFILE_TOP_RATED_LIMIT}`);
  });

  it('ne donne pas de moyenne sans aucune note', async () => {
    const service = createProfileService({
      profiles: fakeProfiles(account()),
      library: fakeLibrary(),
    });

    const profile = await service.get('lectrice', undefined, undefined);

    expect(profile.details?.stats.ratingAverage).toBeNull();
  });

  it('ne montre que le pseudo d’un profil privé à un tiers, sans rien lire de plus', async () => {
    const profiles = fakeProfiles(account({ visibility: 'private' }));
    const service = createProfileService({ profiles, library: fakeLibrary() });

    const profile = await service.get('lectrice', stranger, undefined);

    expect(profile).toEqual({
      handle: 'Lectrice',
      visibility: 'private',
      isOwner: false,
      details: null,
    });
    expect(profiles.calls).toEqual([]);
  });

  it('montre son profil privé à son propriétaire', async () => {
    const service = createProfileService({
      profiles: fakeProfiles(account({ visibility: 'private' })),
      library: fakeLibrary(),
    });

    const profile = await service.get('lectrice', owner, undefined);

    expect(profile.isOwner).toBe(true);
    expect(profile.details).not.toBeNull();
  });
});

describe('ProfileService.listEntries', () => {
  it('lève PROFILE_PRIVATE pour un tiers, sans lire la liste', async () => {
    const library = fakeLibrary();
    const service = createProfileService({
      profiles: fakeProfiles(account({ visibility: 'private' })),
      library,
    });

    const listing = service.listEntries('lectrice', stranger, LIST_INPUT);

    await expect(listing).rejects.toBeInstanceOf(AppError);
    await expect(listing).rejects.toMatchObject({ code: 'PROFILE_PRIVATE' });
    expect(library.listedFor).toEqual([]);
  });

  it('lit la liste du membre, pas celle du lecteur', async () => {
    const library = fakeLibrary();
    const service = createProfileService({ profiles: fakeProfiles(account()), library });

    await service.listEntries('lectrice', stranger, LIST_INPUT);

    expect(library.listedFor).toEqual([OWNER_ID]);
  });
});

describe('ProfileService.setVisibility', () => {
  it('enregistre la visibilité de l’utilisateur', async () => {
    const profiles = fakeProfiles(account());
    const service = createProfileService({ profiles, library: fakeLibrary() });

    await service.setVisibility(OWNER_ID, 'private');

    expect(profiles.calls).toEqual([`setVisibility:${OWNER_ID}:private`]);
  });
});
