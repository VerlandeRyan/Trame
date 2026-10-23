import type { ProfileVisibility } from '../db/database.js';
import { AppError } from '../errors.js';
import type { LibraryEntry, StatusCounts } from '../repositories/library.repository.js';
import type {
  ProfileAccount,
  ProfileRatedWork,
  ProfileRepository,
} from '../repositories/profile.repository.js';
import type { AuthUser } from '../repositories/user.repository.js';
import type { WorkSummary } from '../repositories/work.repository.js';
import type { LibraryPage, LibraryService, ListEntriesInput } from './library.service.js';

export const PROFILE_RECENT_UPDATES_LIMIT = 3;
export const PROFILE_TOP_RATED_LIMIT = 5;

export interface ProfileStats {
  /** Œuvres de la liste, tous statuts confondus. */
  worksFollowed: number;
  /** Moyenne des notes données, sur une décimale ; `null` si aucune note. */
  ratingAverage: number | null;
  statusCounts: StatusCounts;
  /** Chapitres et tomes lus : deux totaux, jamais additionnés. */
  chaptersRead: number;
  volumesRead: number;
}

export interface ProfileUpdate {
  work: WorkSummary;
  entry: LibraryEntry;
  updatedAt: string;
}

export interface ProfileDetails {
  memberSince: string;
  stats: ProfileStats;
  recentUpdates: ProfileUpdate[];
  topRated: ProfileRatedWork[];
}

/** `details` est `null` quand le profil est privé et que le lecteur n'en est pas le propriétaire. */
export interface Profile {
  handle: string;
  visibility: ProfileVisibility;
  isOwner: boolean;
  details: ProfileDetails | null;
}

export interface ProfileService {
  /** `NOT_FOUND` si le handle n'existe pas. */
  get(handle: string, viewer: AuthUser | undefined, lang: string | undefined): Promise<Profile>;
  /** Liste de lecture d'un membre : `PROFILE_PRIVATE` si le profil est privé et qu'on n'en est pas le propriétaire. */
  listEntries(
    handle: string,
    viewer: AuthUser | undefined,
    input: ListEntriesInput,
  ): Promise<LibraryPage>;
  setVisibility(userId: number, visibility: ProfileVisibility): Promise<void>;
}

const sumOf = (counts: StatusCounts): number =>
  Object.values(counts).reduce((sum, count) => sum + count, 0);

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export function createProfileService(deps: {
  profiles: ProfileRepository;
  library: LibraryService;
}): ProfileService {
  const { profiles, library } = deps;

  async function findAccount(handle: string): Promise<ProfileAccount> {
    const account = await profiles.findByHandle(handle);
    if (!account) throw new AppError('NOT_FOUND');
    return account;
  }

  const canSee = (account: ProfileAccount, viewer: AuthUser | undefined): boolean =>
    account.visibility === 'public' || viewer?.id === account.id;

  async function loadDetails(
    account: ProfileAccount,
    lang: string | undefined,
  ): Promise<ProfileDetails> {
    const [figures, recent, topRated] = await Promise.all([
      profiles.figures(account.id),
      profiles.recentUpdates(account.id, lang, PROFILE_RECENT_UPDATES_LIMIT),
      profiles.topRated(account.id, lang, PROFILE_TOP_RATED_LIMIT),
    ]);
    return {
      memberSince: account.memberSince.toISOString(),
      stats: {
        worksFollowed: sumOf(figures.statusCounts),
        ratingAverage:
          figures.ratingCount === 0
            ? null
            : roundToOneDecimal(figures.ratingSum / figures.ratingCount),
        statusCounts: figures.statusCounts,
        chaptersRead: figures.chaptersRead,
        volumesRead: figures.volumesRead,
      },
      recentUpdates: recent.map((update) => ({
        ...update,
        updatedAt: update.updatedAt.toISOString(),
      })),
      topRated,
    };
  }

  return {
    async get(handle, viewer, lang) {
      const account = await findAccount(handle);
      return {
        handle: account.handle,
        visibility: account.visibility,
        isOwner: viewer?.id === account.id,
        details: canSee(account, viewer) ? await loadDetails(account, lang) : null,
      };
    },

    async listEntries(handle, viewer, input) {
      const account = await findAccount(handle);
      if (!canSee(account, viewer)) throw new AppError('PROFILE_PRIVATE');
      return library.listEntries(account.id, input);
    },

    setVisibility: (userId, visibility) => profiles.setVisibility(userId, visibility),
  };
}
