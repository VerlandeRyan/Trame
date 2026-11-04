/** Valeurs d'énumération des comptes et de la liste de lecture, en un seul endroit comme `catalogue-enums.ts`. */

export const LIBRARY_STATUSES = [
  'reading',
  'completed',
  'plan_to_read',
  'on_hold',
  'dropped',
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export const READING_EVENT_KINDS = ['chapters', 'volumes', 'status', 'rating'] as const;
export type ReadingEventKind = (typeof READING_EVENT_KINDS)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFILE_VISIBILITIES = ['public', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
