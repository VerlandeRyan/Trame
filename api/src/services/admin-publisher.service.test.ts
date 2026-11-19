import { describe, expect, it, vi } from 'vitest';
import type {
  AdminPublisherRepository,
  AdminPublisherSummary,
} from '../repositories/admin-publisher.repository.js';
import { createAdminPublisherService } from './admin-publisher.service.js';

const VERSION = '2026-10-24T10:00:00.000Z';
const ADMIN_ID = 5;

const publisher = (overrides: Partial<AdminPublisherSummary> = {}): AdminPublisherSummary => ({
  id: 1,
  name: 'Maison Fictive',
  kind: 'publisher',
  url: null,
  archived: false,
  draft: false,
  activeWorkCount: 0,
  updatedAt: VERSION,
  archivedAt: null,
  archivedBy: null,
  ...overrides,
});

/** Comme le dépôt : l'archivage échoue tant qu'une œuvre non archivée cite l'éditeur. */
function fakeRepository(record: AdminPublisherSummary | null): AdminPublisherRepository {
  return {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    find: vi.fn(async () => record),
    create: vi.fn(async () => 1),
    update: vi.fn(async () => record !== null),
    setArchived: vi.fn(
      async (_id, archived) => record !== null && !(archived && record.activeWorkCount > 0),
    ),
    publish: vi.fn(async () => record !== null),
    deleteRecord: vi.fn(async () => record !== null && record.activeWorkCount === 0),
    countDrafts: vi.fn(async () => 1),
  };
}

describe('liste', () => {
  it('convertit page et taille en limite et décalage', async () => {
    const repository = fakeRepository(null);
    const page = await createAdminPublisherService(repository).list({
      q: 'mai',
      scope: 'archived',
      state: 'all',
      page: 2,
      pageSize: 10,
    });
    expect(repository.list).toHaveBeenCalledWith({
      q: 'mai',
      scope: 'archived',
      state: 'all',
      limit: 10,
      offset: 10,
    });
    expect(page).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
  });
});

describe('archivage', () => {
  it('refuse tant qu’une œuvre non archivée cite l’éditeur', async () => {
    const repository = fakeRepository(publisher({ activeWorkCount: 3 }));
    await expect(
      createAdminPublisherService(repository).archive(1, ADMIN_ID),
    ).rejects.toMatchObject({
      code: 'PUBLISHER_HAS_WORKS',
      details: { activeWorkCount: 3 },
    });
  });

  it('ne réécrit pas un éditeur déjà archivé', async () => {
    const repository = fakeRepository(publisher({ archived: true }));
    await createAdminPublisherService(repository).archive(1, ADMIN_ID);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('archive un éditeur sans œuvre, et le restaure, au nom de l’administrateur', async () => {
    const repository = fakeRepository(publisher());
    const service = createAdminPublisherService(repository);
    await service.archive(1, ADMIN_ID);
    await service.restore(1, ADMIN_ID);
    expect(repository.setArchived).toHaveBeenNthCalledWith(1, 1, true, ADMIN_ID);
    expect(repository.setArchived).toHaveBeenNthCalledWith(2, 1, false, ADMIN_ID);
  });

  it('répond NOT_FOUND pour un éditeur inconnu', async () => {
    const service = createAdminPublisherService(fakeRepository(null));
    await expect(service.archive(9, ADMIN_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.restore(9, ADMIN_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.update(9, {
        name: 'x',
        kind: 'publisher',
        url: null,
        published: true,
        updatedAt: VERSION,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.publish(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.remove(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('version', () => {
  const draft = { name: 'x', kind: 'publisher', url: null, published: true } as const;

  it('transmet la version lue au dépôt, sans la mêler aux données', async () => {
    const repository = fakeRepository(publisher());
    await createAdminPublisherService(repository).update(1, { ...draft, updatedAt: VERSION });
    expect(repository.update).toHaveBeenCalledWith(1, draft, VERSION);
  });

  it('refuse une fiche modifiée entre-temps', async () => {
    const repository = fakeRepository(publisher());
    vi.mocked(repository.update).mockResolvedValueOnce(false);
    await expect(
      createAdminPublisherService(repository).update(1, { ...draft, updatedAt: VERSION }),
    ).rejects.toMatchObject({ code: 'STALE_RECORD' });
  });
});

describe('brouillon', () => {
  it('ne supprime pas un éditeur publié', async () => {
    const repository = fakeRepository(publisher());
    await expect(createAdminPublisherService(repository).remove(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
    expect(repository.deleteRecord).not.toHaveBeenCalled();
  });

  it('supprime un éditeur archivé', async () => {
    const repository = fakeRepository(publisher({ archived: true }));
    await expect(createAdminPublisherService(repository).remove(1)).resolves.toBeUndefined();
    expect(repository.deleteRecord).toHaveBeenCalledWith(1);
  });

  it('refuse de supprimer un éditeur encore cité', async () => {
    const service = createAdminPublisherService(
      fakeRepository(publisher({ draft: true, activeWorkCount: 1 })),
    );
    await expect(service.remove(1)).rejects.toMatchObject({ code: 'RECORD_IN_USE' });
  });

  it('supprime un brouillon libre et le publie', async () => {
    const repository = fakeRepository(publisher({ draft: true }));
    const service = createAdminPublisherService(repository);
    await expect(service.remove(1)).resolves.toBeUndefined();
    await service.publish(1);
    expect(repository.publish).toHaveBeenCalledWith(1);
  });
});
