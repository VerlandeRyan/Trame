import { describe, expect, it, vi } from 'vitest';
import type {
  AdminPublisherRepository,
  AdminPublisherSummary,
} from '../repositories/admin-publisher.repository.js';
import { createAdminPublisherService } from './admin-publisher.service.js';

const publisher = (overrides: Partial<AdminPublisherSummary> = {}): AdminPublisherSummary => ({
  id: 1,
  name: 'Maison Fictive',
  kind: 'publisher',
  url: null,
  archived: false,
  activeWorkCount: 0,
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
  };
}

describe('liste', () => {
  it('convertit page et taille en limite et décalage', async () => {
    const repository = fakeRepository(null);
    const page = await createAdminPublisherService(repository).list({
      q: 'mai',
      scope: 'archived',
      page: 2,
      pageSize: 10,
    });
    expect(repository.list).toHaveBeenCalledWith({
      q: 'mai',
      scope: 'archived',
      limit: 10,
      offset: 10,
    });
    expect(page).toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
  });
});

describe('archivage', () => {
  it('refuse tant qu’une œuvre non archivée cite l’éditeur', async () => {
    const repository = fakeRepository(publisher({ activeWorkCount: 3 }));
    await expect(createAdminPublisherService(repository).archive(1)).rejects.toMatchObject({
      code: 'PUBLISHER_HAS_WORKS',
      details: { activeWorkCount: 3 },
    });
  });

  it('ne réécrit pas un éditeur déjà archivé', async () => {
    const repository = fakeRepository(publisher({ archived: true }));
    await createAdminPublisherService(repository).archive(1);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('archive un éditeur sans œuvre, et le restaure', async () => {
    const repository = fakeRepository(publisher());
    const service = createAdminPublisherService(repository);
    await service.archive(1);
    await service.restore(1);
    expect(repository.setArchived).toHaveBeenNthCalledWith(1, 1, true);
    expect(repository.setArchived).toHaveBeenNthCalledWith(2, 1, false);
  });

  it('répond NOT_FOUND pour un éditeur inconnu', async () => {
    const service = createAdminPublisherService(fakeRepository(null));
    await expect(service.archive(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.restore(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.update(9, { name: 'x', kind: 'publisher', url: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
