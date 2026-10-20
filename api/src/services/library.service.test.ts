import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import type {
  EntryChange,
  LibraryEntry,
  LibraryRepository,
  NewReadingEvent,
} from '../repositories/library.repository.js';
import { createLibraryService } from './library.service.js';

// Règles métier de la liste de lecture, sans base ni HTTP : le dépôt est un faux en mémoire.
const TODAY = '2026-10-20';

function fakeRepository(initial: LibraryEntry | null = null, isWorkAvailable = true) {
  const state = { entry: initial, events: [] as NewReadingEvent[] };
  const repository: LibraryRepository = {
    async isWorkAvailable() {
      return isWorkAvailable;
    },
    async find() {
      return state.entry;
    },
    async save(_userId, _workId, decide: (current: LibraryEntry | null) => EntryChange) {
      const change = decide(state.entry);
      state.entry = change.entry;
      state.events.push(...change.events);
      return change.entry;
    },
    async remove() {
      state.entry = null;
    },
  };
  return { repository, state };
}

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    status: 'reading',
    chaptersRead: 10,
    volumesRead: 2,
    rating: null,
    startedOn: '2026-01-01',
    finishedOn: null,
    ...overrides,
  };
}

function serviceWith(initial: LibraryEntry | null = null, isWorkAvailable = true) {
  const { repository, state } = fakeRepository(initial, isWorkAvailable);
  return { service: createLibraryService(repository, () => TODAY), state };
}

describe('saveEntry : création', () => {
  it('ajoute avec des compteurs à 0 et sans note', async () => {
    const { service } = serviceWith();
    const saved = await service.saveEntry(1, 1, { status: 'plan_to_read' });
    expect(saved).toEqual({
      status: 'plan_to_read',
      chaptersRead: 0,
      volumesRead: 0,
      rating: null,
      startedOn: null,
      finishedOn: null,
    });
  });

  it('propose la date de début en passant à « en cours »', async () => {
    const { service } = serviceWith();
    const saved = await service.saveEntry(1, 1, { status: 'reading' });
    expect(saved.startedOn).toBe(TODAY);
    expect(saved.finishedOn).toBeNull();
  });

  it('propose la date de fin en passant à « terminé »', async () => {
    const { service } = serviceWith();
    const saved = await service.saveEntry(1, 1, { status: 'completed' });
    expect(saved.finishedOn).toBe(TODAY);
  });

  it('respecte les dates saisies', async () => {
    const { service } = serviceWith();
    const saved = await service.saveEntry(1, 1, {
      status: 'reading',
      startedOn: '2025-05-05',
    });
    expect(saved.startedOn).toBe('2025-05-05');
  });
});

describe('saveEntry : mise à jour', () => {
  it('laisse inchangé ce qui est omis', async () => {
    const { service } = serviceWith(entry({ rating: 7 }));
    const saved = await service.saveEntry(1, 1, { status: 'reading', chaptersRead: 11 });
    expect(saved).toEqual(entry({ rating: 7, chaptersRead: 11 }));
  });

  it('retire la note avec null', async () => {
    const { service } = serviceWith(entry({ rating: 7 }));
    const saved = await service.saveEntry(1, 1, { status: 'reading', rating: null });
    expect(saved.rating).toBeNull();
  });

  it('ne change pas les compteurs l’un en fonction de l’autre', async () => {
    const { service } = serviceWith(entry());
    const saved = await service.saveEntry(1, 1, { status: 'reading', volumesRead: 5 });
    expect(saved.chaptersRead).toBe(10);
    expect(saved.volumesRead).toBe(5);
  });

  it('ne repropose pas de date sans changement de statut', async () => {
    const { service } = serviceWith(entry({ startedOn: null }));
    const saved = await service.saveEntry(1, 1, { status: 'reading', chaptersRead: 12 });
    expect(saved.startedOn).toBeNull();
  });

  it('garde la date de début déjà posée en changeant de statut', async () => {
    const { service } = serviceWith(entry({ status: 'on_hold' }));
    const saved = await service.saveEntry(1, 1, { status: 'reading' });
    expect(saved.startedOn).toBe('2026-01-01');
  });
});

describe('saveEntry : journal de lecture', () => {
  it('journalise le statut, les compteurs et la note d’une création', async () => {
    const { service, state } = serviceWith();
    await service.saveEntry(1, 1, {
      status: 'reading',
      chaptersRead: 3,
      volumesRead: 1,
      rating: 8,
    });
    expect(state.events).toEqual([
      { kind: 'status', status: 'reading' },
      { kind: 'chapters', chaptersAdded: 3 },
      { kind: 'volumes', volumesAdded: 1 },
      { kind: 'rating', rating: 8 },
    ]);
  });

  it('journalise la variation des chapitres, négative comprise', async () => {
    const { service, state } = serviceWith(entry({ chaptersRead: 10 }));
    await service.saveEntry(1, 1, { status: 'reading', chaptersRead: 9 });
    expect(state.events).toEqual([{ kind: 'chapters', chaptersAdded: -1 }]);
  });

  it('n’ajoute rien quand rien ne change', async () => {
    const { service, state } = serviceWith(entry());
    await service.saveEntry(1, 1, { status: 'reading', chaptersRead: 10, volumesRead: 2 });
    expect(state.events).toEqual([]);
  });

  it('ne journalise pas le retrait d’une note', async () => {
    const { service, state } = serviceWith(entry({ rating: 7 }));
    await service.saveEntry(1, 1, { status: 'reading', rating: null });
    expect(state.events).toEqual([]);
  });
});

describe('œuvre introuvable ou archivée', () => {
  it.each([
    ['getEntry', (s: ReturnType<typeof serviceWith>['service']) => s.getEntry(1, 1)],
    [
      'saveEntry',
      (s: ReturnType<typeof serviceWith>['service']) => s.saveEntry(1, 1, { status: 'reading' }),
    ],
    ['removeEntry', (s: ReturnType<typeof serviceWith>['service']) => s.removeEntry(1, 1)],
  ])('%s lève NOT_FOUND', async (_name, call) => {
    const { service } = serviceWith(null, false);
    await expect(call(service)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});

describe('removeEntry', () => {
  it('retire l’entrée', async () => {
    const { service, state } = serviceWith(entry());
    await service.removeEntry(1, 1);
    expect(state.entry).toBeNull();
  });
});
