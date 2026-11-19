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
  draft: false,
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
    publish: vi.fn(async () => record !== null),
    deleteRecord: vi.fn(async () => record !== null && record.activeWorkCount === 0),
    countDrafts: vi.fn(async () => 2),
  };
}

describe('liste', () => {
  it('convertit page et taille en limite et décalage', async () => {
    const repository = fakeRepository(null);
    const service = createAdminPersonService(repository);
    const page = await service.list({
      q: 'le',
      scope: 'all',
      state: 'draft',
      page: 3,
      pageSize: 20,
    });
    expect(repository.list).toHaveBeenCalledWith({
      q: 'le',
      scope: 'all',
      state: 'draft',
      limit: 20,
      offset: 40,
    });
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
    await expect(
      service.update(9, { name: 'x', kind: 'person', links: [], published: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.publish(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.remove(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('brouillon', () => {
  it('ne supprime pas une personne publiée', async () => {
    const repository = fakeRepository(person());
    await expect(createAdminPersonService(repository).remove(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
    expect(repository.deleteRecord).not.toHaveBeenCalled();
  });

  it('supprime une personne archivée', async () => {
    const repository = fakeRepository(person({ archived: true }));
    await expect(createAdminPersonService(repository).remove(1)).resolves.toBeUndefined();
    expect(repository.deleteRecord).toHaveBeenCalledWith(1);
  });

  it('répond NOT_REMOVABLE, pas « citée », si la fiche a été restaurée entre-temps', async () => {
    const repository = fakeRepository(person({ archived: true }));
    vi.mocked(repository.find)
      .mockResolvedValueOnce(person({ archived: true }))
      .mockResolvedValueOnce(person());
    vi.mocked(repository.deleteRecord).mockResolvedValue(false);
    await expect(createAdminPersonService(repository).remove(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
  });

  it('répond NOT_FOUND si la fiche a disparu entre-temps', async () => {
    const repository = fakeRepository(person({ archived: true }));
    vi.mocked(repository.find)
      .mockResolvedValueOnce(person({ archived: true }))
      .mockResolvedValueOnce(null);
    vi.mocked(repository.deleteRecord).mockResolvedValue(false);
    await expect(createAdminPersonService(repository).remove(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuse de supprimer une personne encore citée', async () => {
    const service = createAdminPersonService(
      fakeRepository(person({ draft: true, activeWorkCount: 1 })),
    );
    await expect(service.remove(1)).rejects.toMatchObject({ code: 'RECORD_IN_USE' });
  });

  it('supprime un brouillon libre et le publie', async () => {
    const repository = fakeRepository(person({ draft: true }));
    const service = createAdminPersonService(repository);
    await expect(service.remove(1)).resolves.toBeUndefined();
    await service.publish(1);
    expect(repository.publish).toHaveBeenCalledWith(1);
  });
});
