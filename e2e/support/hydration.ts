/** Helper that waits for a page to be interactive. */
import type { Page } from '@playwright/test'

/** The part of the window the helper reads. */
interface NuxtWindow {
  useNuxtApp?: () => { isHydrating: boolean }
}

/**
 * Waits until the page is interactive: Nuxt has finished hydrating. Call it after `goto` and
 * before a click or typing, which a test on a loaded machine would otherwise perform on a still
 * inert page. More reliable than `networkidle`, which waits for the network, not the app state.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as NuxtWindow).useNuxtApp?.().isHydrating === false)
}
