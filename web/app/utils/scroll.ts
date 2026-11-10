/** Scroll behaviour on navigation. */

/** The parts of a route the scroll decision reads. */
interface RouteLike {
  path: string
  query: Record<string, unknown>
}

/** Scroll to the top when the page, `q` or `page` changes; a filter or a sort keeps the position. */
export function shouldScrollToTop(to: RouteLike, from: RouteLike): boolean {
  if (to.path !== from.path) return true
  return to.query.q !== from.query.q || to.query.page !== from.query.page
}
