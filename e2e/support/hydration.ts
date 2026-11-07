import type { Page } from '@playwright/test'

interface NuxtWindow {
  useNuxtApp?: () => { isHydrating: boolean }
}

/**
 * Attend que la page soit interactive : Nuxt a fini d'hydrater. À appeler après `goto` et avant un
 * clic ou une saisie, qu'un test sur une machine chargée ferait sinon dans une page encore inerte.
 * Plus fiable que `networkidle`, qui attend le réseau et non l'état de l'application.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as NuxtWindow).useNuxtApp?.().isHydrating === false)
}
