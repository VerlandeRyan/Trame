/** Business rules of public profiles: who can see what, and the derived reading statistics. */
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

/** Number of recent updates shown on a profile. */
export const PROFILE_RECENT_UPDATES_LIMIT = 3;
/** Number of top-rated works shown on a profile. */
export const PROFILE_TOP_RATED_LIMIT = 5;

/** Reading statistics of a member. */
export interface ProfileStats {
  /** Works in the list, all statuses together. */
  worksFollowed: number;
  /** Average of the ratings given, to one decimal; `null` when there is none. */
  ratingAverage: number | null;
  statusCounts: StatusCounts;
  /** Chapters and volumes read: two totals, never added together. */
  chaptersRead: number;
  volumesRead: number;
}

/** A recently updated entry with its work. */
export interface ProfileUpdate {
  work: WorkSummary;
  entry: LibraryEntry;
  updatedAt: string;
}

/** What a profile shows to those allowed to see it. */
export interface ProfileDetails {
  memberSince: string;
  stats: ProfileStats;
  recentUpdates: ProfileUpdate[];
  topRated: ProfileRatedWork[];
}

/** `details` is `null` when the profile is private and the viewer is not its owner. */
export interface Profile {
  handle: string;
  visibility: ProfileVisibility;
  isOwner: boolean;
  details: ProfileDetails | null;
}

/** Profile operations. */
export interface ProfileService {
  /** `NOT_FOUND` if the handle does not exist. */
  get(handle: string, viewer: AuthUser | undefined, lang: string | undefined): Promise<Profile>;
  /** A member's reading list: `PROFILE_PRIVATE` if the profile is private and the viewer is not its owner. */
  listEntries(
    handle: string,
    viewer: AuthUser | undefined,
    input: ListEntriesInput,
  ): Promise<LibraryPage>;
  setVisibility(userId: number, visibility: ProfileVisibility): Promise<void>;
}

/** Total of the counts over all statuses. */
const sumOf = (counts: StatusCounts): number =>
  Object.values(counts).reduce((sum, count) => sum + count, 0);

/** Rounds to one decimal place. */
const roundToOneDecimal =(value: number): number => Math.round(value * 10) / 10;

/** Creates the profile service; the list of a member reuses the reading-list service. */
export function createProfileService(deps: {
  profiles: ProfileRepository;
  library: LibraryService;
}): ProfileService {
  const { profiles, library } = deps;

  /** Finds the account of a handle, or throws `NOT_FOUND`. */
  async function findAccount(handle: string): Promise<ProfileAccount> {
    const account = await profiles.findByHandle(handle);
    if (!account) throw new AppError('NOT_FOUND');
    return account;
  }

  /** A public profile is visible to everyone, a private one only to its owner. */
  const canSee = (account: ProfileAccount, viewer: AuthUser | undefined): boolean =>
    account.visibility === 'public' || viewer?.id === account.id;

  /** Loads the statistics, recent updates and top-rated works of a profile. */
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
