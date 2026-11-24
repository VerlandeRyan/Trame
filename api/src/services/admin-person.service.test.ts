import { describe, expect, it, vi } from 'vitest';
import type {
  AdminPersonCreateInput,
  AdminPersonDetail,
  AdminPersonRepository,
} from '../repositories/admin-person.repository.js';
import { createAdminPersonService } from './admin-person.service.js';

const VERSION = '2026-10-24T10:00:00.000Z';
const ADMIN_ID = 5;

const person = (overrides: Partial<AdminPersonDetail> = {}): AdminPersonDetail => ({
  id: 1,
  name: 'Léa',
  kind: 'person',
  lifecycle: 'published',
  activeWorkCount: 0,
  links: [],
  updatedAt: VERSION,
  archivedAt: null,
  archivedBy: null,
  ...overrides,
});

/** Comme le dépôt : l'archivage échoue tant qu'une œuvre non archivée cite la personne. */
function fakeRepository(record: AdminPersonDetail | null): AdminPersonRepository {
  return {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    find: vi.fn(async () => record),
    create: vi.fn(async () => 1),
    update: vi.fn(async () => record !== null),
    setArchived: vi.fn(
      async (_id, archived) => record !== null && !(archived && record.activeWorkCount > 0),
    ),
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
      lifecycle: 'draft',
      sort: 'title_desc',
      page: 3,
      pageSize: 20,
    });
    expect(repository.list).toHaveBeenCalledWith({
      q: 'le',
      lifecycle: 'draft',
      sort: 'title_desc',
      limit: 20,
      offset: 40,
    });
    expect(page).toEqual({ items: [], page: 3, pageSize: 20, total: 0 });
  });
});

describe('archivage', () => {
  it('refuse tant que la personne est créditée sur une œuvre non archivée', async () => {
    const repository = fakeRepository(person({ activeWorkCount: 2 }));
    await expect(createAdminPersonService(repository).archive(1, ADMIN_ID)).rejects.toMatchObject({
      code: 'PERSON_HAS_WORKS',
      details: { activeWorkCount: 2 },
    });
  });

  it('ne réécrit pas une personne déjà archivée', async () => {
    const repository = fakeRepository(person({ lifecycle: 'archived' }));
    await createAdminPersonService(repository).archive(1, ADMIN_ID);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('archive une personne sans œuvre, au nom de l’administrateur', async () => {
    const repository = fakeRepository(person());
    const service = createAdminPersonService(repository);
    await service.archive(1, ADMIN_ID);
    await service.restore(1, ADMIN_ID);
    expect(repository.setArchived).toHaveBeenNthCalledWith(1, 1, true, ADMIN_ID);
    expect(repository.setArchived).toHaveBeenNthCalledWith(2, 1, false, ADMIN_ID);
  });

  it('répond NOT_FOUND pour une personne inconnue', async () => {
    const service = createAdminPersonService(fakeRepository(null));
    await expect(service.archive(9, ADMIN_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.restore(9, ADMIN_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.update(9, {
        name: 'x',
        kind: 'person',
        links: [],
        published: true,
        updatedAt: VERSION,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.delete(9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('version', () => {
  const createInput: AdminPersonCreateInput = {
    name: 'x',
    kind: 'person',
    links: [],
    published: true,
  };

  it('transmet la version lue au dépôt, sans la mêler aux données', async () => {
    const repository = fakeRepository(person());
    await createAdminPersonService(repository).update(1, { ...createInput, updatedAt: VERSION });
    expect(repository.update).toHaveBeenCalledWith(1, createInput, VERSION);
  });

  it('refuse une fiche modifiée entre-temps', async () => {
    const repository = fakeRepository(person());
    vi.mocked(repository.update).mockResolvedValueOnce(false);
    await expect(
      createAdminPersonService(repository).update(1, { ...createInput, updatedAt: VERSION }),
    ).rejects.toMatchObject({ code: 'STALE_RECORD' });
  });
});

describe('brouillon', () => {
  it('ne supprime pas une personne publiée', async () => {
    const repository = fakeRepository(person());
    await expect(createAdminPersonService(repository).delete(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
    expect(repository.deleteRecord).not.toHaveBeenCalled();
  });

  it('supprime une personne archivée', async () => {
    const repository = fakeRepository(person({ lifecycle: 'archived' }));
    await expect(createAdminPersonService(repository).delete(1)).resolves.toBeUndefined();
    expect(repository.deleteRecord).toHaveBeenCalledWith(1);
  });

  it('répond NOT_REMOVABLE, pas « citée », si la fiche a été restaurée entre-temps', async () => {
    const repository = fakeRepository(person({ lifecycle: 'archived' }));
    vi.mocked(repository.find)
      .mockResolvedValueOnce(person({ lifecycle: 'archived' }))
      .mockResolvedValueOnce(person());
    vi.mocked(repository.deleteRecord).mockResolvedValue(false);
    await expect(createAdminPersonService(repository).delete(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
  });

  it('répond NOT_FOUND si la fiche a disparu entre-temps', async () => {
    const repository = fakeRepository(person({ lifecycle: 'archived' }));
    vi.mocked(repository.find)
      .mockResolvedValueOnce(person({ lifecycle: 'archived' }))
      .mockResolvedValueOnce(null);
    vi.mocked(repository.deleteRecord).mockResolvedValue(false);
    await expect(createAdminPersonService(repository).delete(1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuse de supprimer une personne encore citée', async () => {
    const service = createAdminPersonService(
      fakeRepository(person({ lifecycle: 'draft', activeWorkCount: 1 })),
    );
    await expect(service.delete(1)).rejects.toMatchObject({ code: 'RECORD_IN_USE' });
  });

  it('supprime un brouillon libre', async () => {
    const repository = fakeRepository(person({ lifecycle: 'draft' }));
    await expect(createAdminPersonService(repository).delete(1)).resolves.toBeUndefined();
    expect(repository.deleteRecord).toHaveBeenCalledWith(1);
  });

  it('publie un brouillon par le remplacement, sans jamais dépublier', async () => {
    const repository = fakeRepository(person({ lifecycle: 'draft' }));
    const service = createAdminPersonService(repository);
    const fields: Omit<AdminPersonCreateInput, 'published'> = {
      name: 'x',
      kind: 'person',
      links: [],
    };
    await service.update(1, { ...fields, published: true, updatedAt: VERSION });
    await service.update(1, { ...fields, updatedAt: VERSION });
    expect(repository.update).toHaveBeenNthCalledWith(
      1,
      1,
      { ...fields, published: true },
      VERSION,
    );
    expect(repository.update).toHaveBeenNthCalledWith(
      2,
      1,
      { ...fields, published: false },
      VERSION,
    );
  });
});
