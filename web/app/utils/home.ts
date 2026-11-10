/** Home page: API response types and pure logic. */
import type { FacetCount, LibraryEntry, WorkFacets } from '../contract/api'
import type { ListUnit } from './reading-list'

export type { FeaturedWork, GenreItem, RatedWork } from '../contract/api'

/** Works requested from the API to fill a row on a large screen; the display trims by width. */
export const SHELF_SIZE = 12

const MAX_EXPLORE_FORMATS = 7
const MAX_EXPLORE_THEMES = 5
const MAX_MENU_THEMES = 8

// Editorial display order; unknown codes follow, alphabetically.
const FORMAT_ORDER = ['manga', 'manhwa', 'manhua', 'bd', 'webtoon', 'webcomic', 'comics']
const THEME_ORDER = [
  'fantasy',
  'humor',
  'science_fiction',
  'adventure',
  'drama',
  'romance',
  'thriller',
  'slice_of_life',
]

/** Sorts codes by the editorial order, unknown ones last in alphabetical order. */
function sortByEditorialOrder(codes: string[], editorialOrder: string[]): string[] {
  /** Position of a code in the editorial order; unknown codes come last. */
  const rankOf = (code: string) => {
    const position = editorialOrder.indexOf(code)
    return position === -1 ? editorialOrder.length : position
  }
  return [...codes].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))
}

/** Formats and genres offered in the home "Explore" block. */
export function pickExploreCodes(items: GenreItem[]): { formats: string[]; themes: string[] } {
  /** Codes of one category, in editorial order, limited to `max`. */
  const codesOfCategory = (category: GenreItem['category'], order: string[], max: number) =>
    sortByEditorialOrder(
      items.filter((item) => item.category === category).map((item) => item.code),
      order,
    ).slice(0, max)
  return {
    formats: codesOfCategory('format', FORMAT_ORDER, MAX_EXPLORE_FORMATS),
    themes: codesOfCategory('theme', THEME_ORDER, MAX_EXPLORE_THEMES),
  }
}

/** Formats and genres of the header "Explore" menu, with their counts, in editorial order. */
export function pickExploreFacets(facets: Pick<WorkFacets, 'format' | 'genre'>): {
  formats: FacetCount[]
  themes: FacetCount[]
} {
  /** Facets in editorial order, limited to `max`, with their counts. */
  const ordered = (items: FacetCount[], order: string[], max: number) => {
    const countOf = new Map(items.map((item) => [item.code, item.count]))
    return sortByEditorialOrder([...countOf.keys()], order)
      .slice(0, max)
      .map((code) => ({ code, count: countOf.get(code) ?? 0 }))
  }
  return {
    formats: ordered(facets.format, FORMAT_ORDER, MAX_EXPLORE_FORMATS),
    themes: ordered(facets.genre, THEME_ORDER, MAX_MENU_THEMES),
  }
}

/** One decimal, formatted for the language ("9,1" in French, "9.1" in English). */
export function formatRatingAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average)
}

/**
 * Direction of a finger swipe: 1 towards the next item (finger moving left), -1 towards the
 * previous one, 0 if the gesture is short or mostly vertical (page scroll).
 */
export function swipeDirection(deltaX: number, deltaY: number, threshold = 40): 1 | -1 | 0 {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < 1.5 * Math.abs(deltaY)) return 0
  return deltaX < 0 ? 1 : -1
}

/** Neighbouring position in the carousel, wrapping around at the ends. */
export function circularIndex(index: number, step: 1 | -1, length: number): number {
  return (index + step + length) % length
}

/** Number of works in the "Continue reading" strip. */
export const CONTINUE_READING_SIZE = 3

/** The +1 counts volumes for a reader who only follows volumes, otherwise chapters. */
export function incrementUnit(entry: Pick<LibraryEntry, 'chaptersRead' | 'volumesRead'>): ListUnit {
  return entry.chaptersRead === 0 && entry.volumesRead > 0 ? 'volumes' : 'chapters'
}
