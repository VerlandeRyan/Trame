import { describe, expect, it, vi } from 'vitest';
import type {
  AdminWorkRecord,
  AdminWorkRepository,
  ArchivedReferences,
  MissingReferences,
  WorkDraft,
} from '../repositories/admin-work.repository.js';
import { createAdminWorkService } from './admin-work.service.js';

const draft: WorkDraft = {
  title: 'Œuvre',
  originalLanguage: 'fr',
  type: 'series',
  status: 'completed',
  chapters: 10,
  volumes: 2,
  startedOn: null,
  endedOn: null,
  titles: [],
  synopses: [],
  credits: [],
  publisherIds: [],
  genres: [],
  relations: [],
  links: [],
};

const NOTHING_MISSING: MissingReferences = {
  personIds: [],
  publisherIds: [],
  workIds: [],
  genres: [],
};

const NOTHING_ARCHIVED: ArchivedReferences = { personIds: [], publisherIds: [], workIds: [] };

function fakeRepository(
  record: AdminWorkRecord | null,
  missing: MissingReferences = NOTHING_MISSING,
  archived: ArchivedReferences = NOTHING_ARCHIVED,
  isUpToDate = true,
): AdminWorkRepository {
  return {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    find: vi.fn(async () => record),
    findMissingReferences: vi.fn(async () => missing),
    findArchivedReferences: vi.fn(async () => archived),
    create: vi.fn(async () => 1),
    update: vi.fn(async () => isUpToDate),
    setArchived: vi.fn(async () => true),
  };
}

const VERSION = '2026-10-24T10:00:00.000Z';

const record = (archived = false): AdminWorkRecord => ({
  ...draft,
  id: 1,
  archived,
  followerCount: 0,
  updatedAt: VERSION,
});

describe('références', () => {
  it('refuse un enregistrement cité qui n’existe pas', async () => {
    const missing = { ...NOTHING_MISSING, genres: ['inconnu'] };
    const repository = fakeRepository(record(), missing);
    await expect(createAdminWorkService(repository).create(draft)).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
      details: missing,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('refuse une relation de l’œuvre avec elle-même', async () => {
    const repository = fakeRepository(record());
    const selfRelated = { ...draft, relations: [{ relatedWorkId: 1, relation: 'other' as const }] };
    await expect(createAdminWorkService(repository).update(1, selfRelated)).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuse de modifier une œuvre inconnue avant toute écriture', async () => {
    const repository = fakeRepository(null);
    await expect(createAdminWorkService(repository).update(1, draft)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuse de citer une fiche archivée', async () => {
    const archived = { ...NOTHING_ARCHIVED, personIds: [3] };
    const repository = fakeRepository(record(), NOTHING_MISSING, archived);
    const credited = { ...draft, credits: [{ personId: 3, role: 'story' as const }] };
    await expect(createAdminWorkService(repository).create(credited)).rejects.toMatchObject({
      code: 'ARCHIVED_REFERENCE',
      details: archived,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('garde une fiche archivée que l’œuvre cite déjà', async () => {
    const archived = { ...NOTHING_ARCHIVED, personIds: [3], publisherIds: [4], workIds: [5] };
    const cited = {
      ...draft,
      credits: [{ personId: 3, role: 'story' as const }],
      publisherIds: [4],
      relations: [{ relatedWorkId: 5, relation: 'other' as const }],
    };
    const repository = fakeRepository({ ...record(), ...cited }, NOTHING_MISSING, archived);
    await createAdminWorkService(repository).update(1, cited);
    expect(repository.update).toHaveBeenCalled();
  });
});

describe('version de la fiche', () => {
  it('transmet la version lue par l’éditeur à l’écriture', async () => {
    const repository = fakeRepository(record());
    await createAdminWorkService(repository).update(1, { ...draft, updatedAt: VERSION });
    expect(repository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: 'Œuvre' }),
      VERSION,
    );
  });

  it('refuse une fiche modifiée entre-temps', async () => {
    const repository = fakeRepository(record(), NOTHING_MISSING, NOTHING_ARCHIVED, false);
    await expect(
      createAdminWorkService(repository).update(1, { ...draft, updatedAt: VERSION }),
    ).rejects.toMatchObject({ code: 'STALE_RECORD' });
  });
});

describe('archivage', () => {
  it('enregistre qui archive', async () => {
    const repository = fakeRepository(record());
    await createAdminWorkService(repository).archive(1, 7);
    expect(repository.setArchived).toHaveBeenCalledWith(1, true, 7);
  });

  it('ne réécrit pas une œuvre déjà archivée', async () => {
    const repository = fakeRepository(record(true));
    await createAdminWorkService(repository).archive(1, 7);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('restaure', async () => {
    const repository = fakeRepository(record(true));
    await createAdminWorkService(repository).restore(1, 7);
    expect(repository.setArchived).toHaveBeenCalledWith(1, false, 7);
  });
});
