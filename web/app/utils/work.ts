/** Work page: response types and pure display logic (tested without Nuxt). */
import type { RelationKind, WorkDetail, WorkRelation } from '../contract/api'

export type {
  CreditRole,
  ExternalLink,
  RelationKind,
  WorkCredit,
  WorkDetail,
  WorkRelation,
  WorkStatus,
  WorkType,
} from '../contract/api'

const MAX_SLUG_LENGTH = 60

/** Removes leading and trailing dashes (without a regular expression: no backtracking). */
function trimDashes(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value[start] === '-') start++
  while (end > start && value[end - 1] === '-') end--
  return value.slice(start, end)
}

/** Lowercase without accents: to compare or filter labels regardless of how they were typed. */
export function foldAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

/** Text to URL slug: lowercase, no accents, dashes. */
export function slugify(text: string): string {
  const dashed = foldAccents(text).replace(/[^a-z0-9]+/g, '-')
  return trimDashes(trimDashes(dashed).slice(0, MAX_SLUG_LENGTH))
}

/** Canonical URL segment of a work: `42-some-title` (or `42` if the title has no usable character). */
export function workSlug(id: number, title: string): string {
  const slug = slugify(title)
  return slug === '' ? String(id) : `${id}-${slug}`
}

/** Reads the `{id}-{slug}` segment: only the identifier matters; `null` if it is not a positive integer. */
export function parseWorkId(segment: string): number | null {
  const match = /^([1-9]\d{0,14})(?:-.*)?$/.exec(segment)
  return match?.[1] ? Number(match[1]) : null
}

/** Total of a work: "?" while it is not filled in (ongoing work). */
export function formatTotal(total: number | null): string {
  return total === null ? '?' : String(total)
}

/** `https://` only: any other scheme (javascript:, http:, data:…) is never shown as a link. */
export function isSafeLink(url: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(url)
}

/** Social network or website kind of an external link. */
export type LinkNetwork =
  | 'x'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'bluesky'
  | 'twitch'
  | 'discord'
  | 'patreon'
  | 'tumblr'
  | 'pixiv'
  | 'website'

// Networks recognised by their domain; any other link is a website.
const NETWORK_HOSTS: [RegExp, LinkNetwork][] = [
  [/(^|\.)(x|twitter)\.com$/, 'x'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'facebook'],
  [/(^|\.)bsky\.app$/, 'bluesky'],
  [/(^|\.)twitch\.tv$/, 'twitch'],
  [/(^|\.)discord\.(gg|com)$/, 'discord'],
  [/(^|\.)patreon\.com$/, 'patreon'],
  [/(^|\.)tumblr\.com$/, 'tumblr'],
  [/(^|\.)pixiv\.net$/, 'pixiv'],
]

/** Network of an external link from its domain, `website` by default. */
export function linkNetwork(url: string): LinkNetwork {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'website'
  }
  return NETWORK_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'website'
}

/** A cover is shown only if its path is an https URL or a path of this site. */
export function coverUrl(path: string | null): string | undefined {
  if (path === null) return undefined
  return isSafeLink(path) || path.startsWith('/') ? path : undefined
}

/** Groups of related works, in display order; the key is also the i18n key (`relationGroup.<key>`). */
export type RelationGroupKey =
  | 'prequel'
  | 'sequel'
  | 'spin_off_parent'
  | 'spin_off'
  | 'side_story_parent'
  | 'side_story'
  | 'adaptation_source'
  | 'adaptation'
  | 'alternate_version'
  | 'shared_universe'
  | 'part_of'
  | 'contains'
  | 'other'

/** Display order of the related-work groups. */
const GROUP_ORDER: RelationGroupKey[] = [
  'sequel',
  'prequel',
  'spin_off',
  'spin_off_parent',
  'side_story',
  'side_story_parent',
  'adaptation',
  'adaptation_source',
  'alternate_version',
  'shared_universe',
  'contains',
  'part_of',
  'other',
]

// Only one direction is stored ("source — relation — target"): the inverse is derived here.
const GROUP_BY_RELATION: Record<RelationKind, Record<'outgoing' | 'incoming', RelationGroupKey>> = {
  sequel: { outgoing: 'prequel', incoming: 'sequel' },
  prequel: { outgoing: 'sequel', incoming: 'prequel' },
  spin_off: { outgoing: 'spin_off_parent', incoming: 'spin_off' },
  side_story: { outgoing: 'side_story_parent', incoming: 'side_story' },
  adaptation: { outgoing: 'adaptation_source', incoming: 'adaptation' },
  alternate_version: { outgoing: 'alternate_version', incoming: 'alternate_version' },
  shared_universe: { outgoing: 'shared_universe', incoming: 'shared_universe' },
  contains: { outgoing: 'contains', incoming: 'part_of' },
  other: { outgoing: 'other', incoming: 'other' },
}

/** A group of related works under one label. */
export interface RelationGroup {
  key: RelationGroupKey
  works: WorkRelation['work'][]
}

/** Groups related works by label, without duplicate works in a group, in display order. */
export function groupRelations(relations: WorkRelation[]): RelationGroup[] {
  const byKey = new Map<RelationGroupKey, WorkRelation['work'][]>()
  for (const { relation, direction, work } of relations) {
    const key = GROUP_BY_RELATION[relation][direction]
    const works = byKey.get(key) ?? []
    if (!works.some((existing) => existing.id === work.id)) works.push(work)
    byKey.set(key, works)
  }
  return GROUP_ORDER.flatMap((key) => {
    const works = byKey.get(key)
    return works ? [{ key, works }] : []
  })
}

/** People shown before the "See all" fold (beyond 3 people). */
export const PEOPLE_COLLAPSED_COUNT = 3

/** Meta description: the start of the synopsis (without line breaks), otherwise the given fallback. */
export function metaDescription(
  synopsis: string | null,
  fallback: string,
  maxLength = 160,
): string {
  const text = synopsis?.replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  if (text.length <= maxLength) return text
  // Cut at the last space so the text does not end mid-word (spaces are already normalised).
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}

/** JSON-LD ready for a `<script>` tag: `<` is escaped so a title cannot close the tag. */
export function serializeJsonLd(json: Record<string, unknown>): string {
  return JSON.stringify(json).replaceAll('<', String.raw`\u${'003c'}`)
}

/** Alternative titles shown under the title ("EN : Work Title · DE : Werktitel"), without duplicates. */
export function formatAlternativeTitles(titles: WorkDetail['alternativeTitles']): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const { language, title } of titles) {
    const part = `${language.toUpperCase()} : ${title}`
    if (!seen.has(part)) {
      seen.add(part)
      parts.push(part)
    }
  }
  return parts.join(' · ')
}

/** schema.org structured data of the work (`ComicSeries` for a series or an anthology). */
export function buildJsonLd(
  work: WorkDetail,
  url: string,
  description: string,
): Record<string, unknown> {
  const creators = work.credits.map((credit) => ({
    '@type': credit.kind === 'collective' ? 'Organization' : 'Person',
    name: credit.name,
  }))
  const publishers = work.publishers.map((publisher) => ({
    '@type': 'Organization',
    name: publisher.name,
  }))
  const sameAs = work.links.filter((link) => isSafeLink(link.url)).map((link) => link.url)
  return {
    '@context': 'https://schema.org',
    '@type': work.type === 'oneshot' ? 'CreativeWork' : 'ComicSeries',
    name: work.title,
    url,
    inLanguage: work.originalLanguage,
    ...(description ? { description } : {}),
    ...(creators.length > 0 ? { creator: creators } : {}),
    ...(publishers.length > 0 ? { publisher: publishers } : {}),
    ...(work.formats.length + work.genres.length > 0
      ? { genre: [...work.formats, ...work.genres] }
      : {}),
    ...(work.startedOn ? { datePublished: work.startedOn } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(work.ratingAverage !== null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: work.ratingAverage,
            ratingCount: work.ratingCount,
            bestRating: 10,
            worstRating: 1,
          },
        }
      : {}),
  }
}
