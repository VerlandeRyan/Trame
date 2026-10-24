/** Valeurs d'énumération du catalogue, en un seul endroit : Zod, OpenAPI et types en dérivent. */

/** Structure de l'histoire ; le format (manga, webtoon…) est dans la table `genre`. */
export const WORK_TYPES = ['series', 'oneshot', 'anthology'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_STATUSES = ['upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const CREDIT_ROLES = ['story', 'art', 'colors', 'other'] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number];

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

export const PUBLISHER_KINDS = ['publisher', 'platform', 'self_published'] as const;
export type PublisherKind = (typeof PUBLISHER_KINDS)[number];

export const EXTERNAL_LINK_KINDS = ['read', 'buy', 'website', 'social'] as const;
export type ExternalLinkKind = (typeof EXTERNAL_LINK_KINDS)[number];
/** Une œuvre se lit ou s'achète ; le site et les réseaux sociaux sont ceux d'une personne. */
export const WORK_LINK_KINDS = ['read', 'buy'] as const satisfies readonly ExternalLinkKind[];
export const PERSON_LINK_KINDS = [
  'website',
  'social',
] as const satisfies readonly ExternalLinkKind[];

export const PERSON_KINDS = ['person', 'collective'] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

/** `format` : manga, manhwa, bd, webtoon, webcomic… ; `theme` : fantasy, humor… */
export const GENRE_CATEGORIES = ['format', 'theme'] as const;
export type GenreCategory = (typeof GENRE_CATEGORIES)[number];

export const TITLE_KINDS = ['translated', 'international', 'former', 'short'] as const;
export type TitleKind = (typeof TITLE_KINDS)[number];

/** `official` (éditeur, auteur) > `human` (contributeur) > `machine` (traduction automatique). */
export const SYNOPSIS_SOURCES = ['official', 'human', 'machine'] as const;
export type SynopsisSource = (typeof SYNOPSIS_SOURCES)[number];
