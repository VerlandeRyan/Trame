/** Allowed cover widths, in pixels. No screen invents another one. */
export const COVER_SIZES = { sm: 64, md: 72, lg: 96, xl: 112, hero: 210 } as const

/** Name of an allowed cover size. */
export type CoverSize = keyof typeof COVER_SIZES
