// Largeurs de couverture autorisées, en pixels. Aucun écran n'en invente une autre.
export const COVER_SIZES = { sm: 64, md: 72, lg: 96, xl: 112, hero: 210 } as const

export type CoverSize = keyof typeof COVER_SIZES
