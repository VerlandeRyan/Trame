interface RouteLike {
  path: string
  query: Record<string, unknown>
}

/** Remonter quand la page, `q` ou `page` change ; un filtre ou un tri garde la position. */
export function shouldScrollToTop(to: RouteLike, from: RouteLike): boolean {
  if (to.path !== from.path) return true
  return to.query.q !== from.query.q || to.query.page !== from.query.page
}
