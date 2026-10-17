// Accueil : types des réponses de l'API et logique pure.
import type { WorkSummary } from './search'

export interface FeaturedWork extends WorkSummary {
  synopsis: string | null
  recentAdditions: number
}

export interface RatedWork extends WorkSummary {
  ratingAverage: number
  ratingCount: number
}

export interface GenreItem {
  code: string
  category: 'format' | 'theme'
}

/** Demandées à l'API pour remplir une ligne sur grand écran ; l'affichage coupe selon la largeur. */
export const SHELF_SIZE = 12

const MAX_EXPLORE_FORMATS = 7
const MAX_EXPLORE_THEMES = 5

// Ordre éditorial des maquettes ; les codes inconnus suivent, par ordre alphabétique.
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

function sortByEditorialOrder(codes: string[], editorialOrder: string[]): string[] {
  const rankOf = (code: string) => {
    const position = editorialOrder.indexOf(code)
    return position === -1 ? editorialOrder.length : position
  }
  return [...codes].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b))
}

/** Formats puis genres proposés dans « Explorer ». */
export function pickExploreCodes(items: GenreItem[]): { formats: string[]; themes: string[] } {
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

/** Une décimale, au format de la langue (« 9,1 » en français, « 9.1 » en anglais). */
export function formatRatingAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average)
}

/**
 * Sens d'un glissement du doigt : 1 vers la suite (doigt vers la gauche), -1 vers le retour,
 * 0 si le geste est court ou plutôt vertical (défilement de la page).
 */
export function swipeDirection(deltaX: number, deltaY: number, threshold = 40): 1 | -1 | 0 {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < 1.5 * Math.abs(deltaY)) return 0
  return deltaX < 0 ? 1 : -1
}

/** Position voisine dans le carrousel, qui reboucle aux extrémités. */
export function circularIndex(index: number, step: 1 | -1, length: number): number {
  return (index + step + length) % length
}
