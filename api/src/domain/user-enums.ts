/** Account and reading-list enumeration values, in a single place like `catalogue-enums.ts`. */

/** Reading status of a work in a member's list. */
export const LIBRARY_STATUSES = [
  'reading',
  'completed',
  'plan_to_read',
  'on_hold',
  'dropped',
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

/** What a reading-journal line records. */
export const READING_EVENT_KINDS = ['chapters', 'volumes', 'status', 'rating'] as const;
export type ReadingEventKind = (typeof READING_EVENT_KINDS)[number];

/** Account role. */
export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Who can see a member's profile. */
export const PROFILE_VISIBILITIES = ['public', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
