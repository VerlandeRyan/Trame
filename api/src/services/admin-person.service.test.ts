import { describe, expect, it, vi } from 'vitest';
import type {
  AdminPersonRecord,
  AdminPersonRepository,
} from '../repositories/admin-person.repository.js';
import { createAdminPersonService } from './admin-person.service.js';

const person = (overrides: Partial<AdminPersonRecord> = {}): AdminPersonRecord => ({
  id: 1,
  name: 'Léa',
  kind: 'person',
  archived: false,
  activeWorkCount: 0,
  links: [],
  ...overrides,
});

/** Comme le dépôt : l'archivage échoue tant qu'une œuvre non archivée cite la personne. */
function fakeRepository(record: AdminPersonRecord | null): AdminPersonRepository {
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
    const service = createAdminPersonService(repository);
    const page = await service.list({ q: 'le', scope: 'all', page: 3, pageSize: 20 });
    expect(repository.list).toHaveBeenCalledWith({ q: 'le', scope: 'all', limit: 20, offset: 40 });
    expect(page).toEqual({ items: [], page: 3, pageSize: 20, total: 0 });
  });
});

describe('archivage', () => {
  it('refuse tant que la personne est créditée sur une œuvre non archivée', async () => {
    const repository = fakeRepository(person({ activeWorkCount: 2 }));
    await expect(createAdminPersonService(repository).archive(1)).rejects.toMatchObject({
      code: 'PERSON_HAS_WORKS',
      details: { activeWorkCount: 2 },
    });
  });

  it('ne réécrit pas une personne déjà archivée', async () => {
    const repository = fakeRepository(person({ archived: true }));
    await createAdminPersonService(repository).archive(1);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('archive une personne sans œuvre', async () => {
    const repository = fakeRepository(person());
    await createAdminPersonService(repository).archive(1);
    expect(repository.setArchived).toHaveBeenCalledWith(1, true);
  });

  it('répond NOT_FOUND pour une personne inconnue', async () => {
    const service = createAdminPersonService(fakeRepository(null));
    await expect(service.archive(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.restore(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.update(9, { name: 'x', kind: 'person', links: [] })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });
});
