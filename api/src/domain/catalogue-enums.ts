/** Catalogue enumeration values, in a single place: validation, API documentation and types derive from them. */

/** Structure of the story; the format (manga, webtoon…) is a genre of the `format` category. */
export const WORK_TYPES = ['series', 'oneshot', 'anthology'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** Publication status of a work. */
export const WORK_STATUSES = ['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

/** Role of a person credited on a work. */
export const CREDIT_ROLES = ['story', 'art', 'colors', 'other'] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number];

/** How a work relates to another one. */
export const RELATION_KINDS = [
  'sequel',
  'prequel',
  'spin_off',
  'side_story',
  'adaptation',
  'alternate_version',
  'shared_universe',
  'contains',
  'other',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Kind of publishing entity. */
export const PUBLISHER_KINDS = ['publisher', 'platform', 'self_published'] as const;
export type PublisherKind = (typeof PUBLISHER_KINDS)[number];

/** Kind of external link. */
export const EXTERNAL_LINK_KINDS = ['read', 'buy', 'website', 'social'] as const;
export type ExternalLinkKind = (typeof EXTERNAL_LINK_KINDS)[number];
/** A work is read or bought; the website and social networks belong to a person. */
export const WORK_LINK_KINDS = ['read', 'buy'] as const satisfies readonly ExternalLinkKind[];
/** Link kinds allowed on a person. */
export const PERSON_LINK_KINDS = [
  'website',
  'social',
] as const satisfies readonly ExternalLinkKind[];

/** Whether a creator is an individual or a collective. */
export const PERSON_KINDS = ['person', 'collective'] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

/** `format`: manga, manhwa, bd, webtoon, webcomic…; `theme`: fantasy, humor… */
export const GENRE_CATEGORIES = ['format', 'theme'] as const;
export type GenreCategory = (typeof GENRE_CATEGORIES)[number];

/** Kind of alternative title. */
export const TITLE_KINDS = ['translated', 'international', 'former', 'short'] as const;
export type TitleKind = (typeof TITLE_KINDS)[number];

/** Origin of a synopsis: `official` (publisher, author) > `human` (contributor) > `machine` (automatic translation). */
export const SYNOPSIS_SOURCES = ['official', 'human', 'machine'] as const;
export type SynopsisSource = (typeof SYNOPSIS_SOURCES)[number];
