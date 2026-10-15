// Fiche œuvre : types de la réponse `GET /works/:id` et logique pure d'affichage (testée sans Nuxt).

export type WorkType = 'series' | 'oneshot' | 'anthology'
export type WorkStatus = 'upcoming' | 'ongoing' | 'completed' | 'hiatus' | 'abandoned'
export type CreditRole = 'story' | 'art' | 'colors' | 'other'
export type RelationKind =
  | 'sequel'
  | 'prequel'
  | 'spin_off'
  | 'side_story'
  | 'adaptation'
  | 'alternate_version'
  | 'shared_universe'
  | 'contains'
  | 'other'

export interface ExternalLink {
  kind: 'read' | 'buy' | 'website' | 'social'
  url: string
  label: string | null
}

export interface WorkCredit {
  personId: number
  name: string
  kind: 'person' | 'collective'
  roles: CreditRole[]
  links: ExternalLink[]
}

export interface WorkRelation {
  relation: RelationKind
  direction: 'outgoing' | 'incoming'
  work: { id: number; title: string; type: WorkType }
}

export interface WorkDetail {
  id: number
  title: string
  originalTitle: string
  originalLanguage: string
  type: WorkType
  status: WorkStatus
  synopsis: string | null
  synopsisLanguage: string | null
  synopsisSource: 'official' | 'human' | 'machine' | null
  chapters: number | null
  volumes: number | null
  startedOn: string | null
  endedOn: string | null
  coverPath: string | null
  alternativeTitles: { language: string; kind: string; title: string }[]
  credits: WorkCredit[]
  publishers: { id: number; name: string; kind: string; url: string | null }[]
  formats: string[]
  genres: string[]
  links: ExternalLink[]
  relations: WorkRelation[]
  memberCount: number
  ratingCount: number
  ratingAverage: number | null
}

const MAX_SLUG_LENGTH = 60

/** Retire les tirets de début et de fin (sans expression rationnelle : pas de retour arrière). */
function trimDashes(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value[start] === '-') start++
  while (end > start && value[end - 1] === '-') end--
  return value.slice(start, end)
}

/** Texte → slug d'URL : minuscules, sans accents, tirets. */
export function slugify(text: string): string {
  const dashed = text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  return trimDashes(trimDashes(dashed).slice(0, MAX_SLUG_LENGTH))
}

/** Segment d'URL canonique d'une fiche : `42-ripper` (ou `42` si le titre n'a aucun caractère utile). */
export function workSlug(id: number, title: string): string {
  const slug = slugify(title)
  return slug === '' ? String(id) : `${id}-${slug}`
}

/** Lit le segment `{id}-{slug}` : seul l'identifiant compte ; `null` s'il n'est pas un entier positif. */
export function parseWorkId(segment: string): number | null {
  const match = /^([1-9]\d{0,14})(?:-.*)?$/.exec(segment)
  return match?.[1] ? Number(match[1]) : null
}

/** Total d'une œuvre : « ? » tant qu'il n'est pas renseigné (œuvre en cours, RG-18). */
export function formatTotal(total: number | null): string {
  return total === null ? '?' : String(total)
}

/** `https://` uniquement : tout autre schéma (javascript:, http:, data:…) n'est jamais affiché comme lien. */
export function isSafeLink(url: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(url)
}

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

// Réseaux reconnus par leur domaine ; tout autre lien est un site web.
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

/** Réseau d'un lien externe d'après son domaine, `website` par défaut. */
export function linkNetwork(url: string): LinkNetwork {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'website'
  }
  return NETWORK_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'website'
}

/** Une couverture n'est affichée que si son chemin est une URL https ou un chemin du site. */
export function coverUrl(path: string | null): string | undefined {
  if (path === null) return undefined
  return isSafeLink(path) || path.startsWith('/') ? path : undefined
}

/** Groupes d'œuvres liées, dans l'ordre d'affichage ; la clé sert de clé i18n (`relationGroup.<clé>`). */
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

// Un seul sens est stocké (« source — relation — cible ») : l'inverse est déduit ici.
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

export interface RelationGroup {
  key: RelationGroupKey
  works: WorkRelation['work'][]
}

/** Regroupe les œuvres liées par libellé, sans doublon d'œuvre dans un groupe, dans l'ordre d'affichage. */
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

/** Personnes affichées avant le repli « Voir tout » (maquette : au-delà de 3 personnes). */
export const PEOPLE_COLLAPSED_COUNT = 3

/** Description `meta` : début du synopsis (sans retour à la ligne), sinon repli fourni. */
export function metaDescription(
  synopsis: string | null,
  fallback: string,
  maxLength = 160,
): string {
  const text = synopsis?.replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  if (text.length <= maxLength) return text
  // Coupe au dernier espace pour ne pas finir au milieu d'un mot (espaces déjà normalisés).
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}

/** JSON-LD prêt à placer dans un `<script>` : `<` échappé pour qu'un titre ne puisse pas fermer la balise. */
export function serializeJsonLd(json: Record<string, unknown>): string {
  return JSON.stringify(json).replaceAll('<', String.raw`\u${'003c'}`)
}

/** Titres alternatifs affichés sous le titre : « EN : Work Title · DE : Werktitel », sans doublon. */
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

/** Balisage structuré schema.org de la fiche (`ComicSeries` pour une série ou une anthologie). */
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
