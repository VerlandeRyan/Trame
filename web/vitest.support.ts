// Values shared by the unit tests (imported as `~~/vitest.support`).

/**
 * Time allowed for a navigation to a page that has not been loaded yet. `vi.waitFor` gives up
 * after 1 s by default, which a loaded machine can exceed while the page component loads.
 */
export const NAVIGATION_TIMEOUT_MS = 5000
