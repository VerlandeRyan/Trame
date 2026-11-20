import { describe, expect, it, vi, type Mock } from 'vitest';
import type {
  AdminWorkRecord,
  AdminWorkRepository,
  ArchivedReferences,
  MissingReferences,
  ReferenceReader,
  WorkDraft,
} from '../repositories/admin-work.repository.js';
import type { Lifecycle } from '../repositories/admin-sql.js';
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
  synopses: [{ language: 'fr', text: 'Résumé', source: 'official' }],
  credits: [{ personId: 1, role: 'story' }],
  publisherIds: [1],
  genres: [],
  relations: [],
  links: [],
  published: true,
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
  hasFormat = true,
  drafts: ArchivedReferences = NOTHING_ARCHIVED,
): AdminWorkRepository & { references: ReferenceReader; written: Mock } {
  const references: ReferenceReader = {
    lookUpReferences: vi.fn(async () => ({ missing, hasFormat })),
    findArchivedReferences: vi.fn(async () => archived),
    findDraftReferences: vi.fn(async () => drafts),
  };
  /** Called once the references check passed, like the repository's write after its check. */
  const written = vi.fn();
  return {
    references,
    written,
    list: vi.fn(async () => ({ items: [], total: 0 })),
    find: vi.fn(async () => record),
    create: vi.fn(async (_draft, check) => {
      await check(references);
      written();
      return 1;
    }),
    update: vi.fn(async (_id, _draft, _version, check) => {
      await check(references);
      written();
      return isUpToDate;
    }),
    setArchived: vi.fn(async () => true),
    deleteRecord: vi.fn(async () => true),
    countDrafts: vi.fn(async () => 3),
  };
}

const VERSION = '2026-10-24T10:00:00.000Z';

/** The data of a replacement: the draft and the version that was read. */
const replacing = (input: WorkDraft) => ({ ...input, updatedAt: VERSION });

const { published: _published, ...WORK_FIELDS } = draft;

const record = (lifecycle: Lifecycle = 'published'): AdminWorkRecord => ({
  ...WORK_FIELDS,
  id: 1,
  lifecycle,
  labels: { people: [], publishers: [], works: [] },
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
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('refuse une œuvre sans format, à la création comme à la modification', async () => {
    const repository = fakeRepository(record(), NOTHING_MISSING, NOTHING_ARCHIVED, true, false);
    const service = createAdminWorkService(repository);
    const expected = {
      code: 'VALIDATION_ERROR',
      details: [{ path: ['genres'], code: 'too_small' }],
    };

    await expect(service.create(draft)).rejects.toMatchObject(expected);
    await expect(service.update(1, replacing(draft))).rejects.toMatchObject(expected);
    expect(repository.written).not.toHaveBeenCalled();
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('refuse une relation de l’œuvre avec elle-même', async () => {
    const repository = fakeRepository(record());
    const selfRelated = { ...draft, relations: [{ relatedWorkId: 1, relation: 'other' as const }] };
    await expect(
      createAdminWorkService(repository).update(1, replacing(selfRelated)),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('refuse de modifier une œuvre inconnue avant toute écriture', async () => {
    const repository = fakeRepository(null);
    await expect(
      createAdminWorkService(repository).update(1, replacing(draft)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('refuse de citer une fiche archivée', async () => {
    const archived = { ...NOTHING_ARCHIVED, personIds: [3] };
    const repository = fakeRepository(record(), NOTHING_MISSING, archived);
    const credited = { ...draft, credits: [{ personId: 3, role: 'story' as const }] };
    await expect(createAdminWorkService(repository).create(credited)).rejects.toMatchObject({
      code: 'ARCHIVED_REFERENCE',
      details: archived,
    });
    expect(repository.written).not.toHaveBeenCalled();
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
    await createAdminWorkService(repository).update(1, replacing(cited));
    expect(repository.update).toHaveBeenCalled();
  });
});

describe('brouillon', () => {
  const asDraft = { ...draft, published: false };

  it('n’exige pas de format ni de fiche publiée pour un brouillon', async () => {
    const draftsCited = { ...NOTHING_ARCHIVED, personIds: [3] };
    const repository = fakeRepository(
      record('draft'),
      NOTHING_MISSING,
      NOTHING_ARCHIVED,
      true,
      false,
      draftsCited,
    );
    const service = createAdminWorkService(repository);
    await service.create(asDraft);
    await service.update(1, replacing(asDraft));
    expect(repository.create).toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalled();
    expect(repository.references.findDraftReferences).not.toHaveBeenCalled();
  });

  it('refuse une œuvre publiée qui cite un brouillon', async () => {
    const draftsCited = { ...NOTHING_ARCHIVED, workIds: [8] };
    const repository = fakeRepository(
      record(),
      NOTHING_MISSING,
      NOTHING_ARCHIVED,
      true,
      true,
      draftsCited,
    );
    await expect(createAdminWorkService(repository).create(draft)).rejects.toMatchObject({
      code: 'DRAFT_REFERENCE',
      details: draftsCited,
    });
  });

  it('publie un brouillon complet dans le même remplacement', async () => {
    const repository = fakeRepository(record('draft'));
    await createAdminWorkService(repository).update(1, replacing(draft));
    expect(repository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ published: true }),
      VERSION,
      expect.any(Function),
    );
    expect(repository.references.findDraftReferences).toHaveBeenCalledOnce();
  });

  it('garde un brouillon brouillon quand le remplacement ne demande pas la publication', async () => {
    const repository = fakeRepository(record('draft'));
    const { published: _omitted, ...withoutPublished } = draft;
    await createAdminWorkService(repository).update(1, { ...withoutPublished, updatedAt: VERSION });
    expect(repository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ published: false }),
      VERSION,
      expect.any(Function),
    );
  });

  it('ne dépublie jamais une œuvre publiée, même avec published: false', async () => {
    const repository = fakeRepository(record());
    await createAdminWorkService(repository).update(1, replacing({ ...draft, published: false }));
    expect(repository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ published: true }),
      VERSION,
      expect.any(Function),
    );
  });

  it('refuse de publier un brouillon sans format', async () => {
    const repository = fakeRepository(
      record('draft'),
      NOTHING_MISSING,
      NOTHING_ARCHIVED,
      true,
      false,
    );
    await expect(
      createAdminWorkService(repository).update(1, replacing(draft)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('refuse de publier un brouillon qui cite un brouillon', async () => {
    const draftsCited = { ...NOTHING_ARCHIVED, workIds: [8] };
    const repository = fakeRepository(
      record('draft'),
      NOTHING_MISSING,
      NOTHING_ARCHIVED,
      true,
      true,
      draftsCited,
    );
    await expect(
      createAdminWorkService(repository).update(1, replacing(draft)),
    ).rejects.toMatchObject({ code: 'DRAFT_REFERENCE', details: draftsCited });
    expect(repository.written).not.toHaveBeenCalled();
  });

  it('ne supprime qu’un brouillon ou une œuvre archivée', async () => {
    const published = fakeRepository(record());
    await expect(createAdminWorkService(published).remove(1)).rejects.toMatchObject({
      code: 'NOT_REMOVABLE',
    });
    const draftRepository = fakeRepository(record('draft'));
    await expect(createAdminWorkService(draftRepository).remove(1)).resolves.toBeUndefined();
    expect(draftRepository.deleteRecord).toHaveBeenCalledWith(1);
    const archivedRepository = fakeRepository(record('archived'));
    await expect(createAdminWorkService(archivedRepository).remove(1)).resolves.toBeUndefined();
    expect(archivedRepository.deleteRecord).toHaveBeenCalledWith(1);
  });

  it('refuse de supprimer une œuvre encore liée', async () => {
    const repository = fakeRepository(record('archived'));
    vi.mocked(repository.deleteRecord).mockResolvedValue(false);
    await expect(createAdminWorkService(repository).remove(1)).rejects.toMatchObject({
      code: 'RECORD_IN_USE',
    });
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
      expect.any(Function),
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
    const repository = fakeRepository(record('archived'));
    await createAdminWorkService(repository).archive(1, 7);
    expect(repository.setArchived).not.toHaveBeenCalled();
  });

  it('restaure', async () => {
    const repository = fakeRepository(record('archived'));
    await createAdminWorkService(repository).restore(1, 7);
    expect(repository.setArchived).toHaveBeenCalledWith(1, false, 7);
  });
});
