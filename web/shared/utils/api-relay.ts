/**
 * Rules of the API relay: kept in `shared/` so the server uses them without an import and the
 * tests can reach them.
 */
const READ_METHODS = new Set(['GET', 'HEAD'])
// A write route is added here together with the feature that needs it.
const WRITABLE_ROUTES = [
  { methods: new Set(['POST']), path: /^auth\// },
  { methods: new Set(['PUT', 'DELETE']), path: /^works\/\d+\/entry$/ },
  { methods: new Set(['PATCH']), path: /^me\/profile$/ },
  // Catalogue administration: create, replace, archive and restore.
  { methods: new Set(['POST']), path: /^admin\/(people|publishers|works)$/ },
  { methods: new Set(['PUT']), path: /^admin\/(people|publishers|works)\/\d+$/ },
  {
    methods: new Set(['POST']),
    path: /^admin\/(people|publishers|works)\/\d+\/(archive|restore)$/,
  },
]

/** Decision on a relayed request. */
export type RelayVerdict = 'allowed' | 'bad-request' | 'method-not-allowed'

/** Decoded path: `%2e%2e` and `%2f` must be seen as `..` and `/` before the check. */
function decodePath(path: string): string | undefined {
  try {
    return decodeURIComponent(path)
  } catch {
    return undefined
  }
}

/** Decides whether a request may be relayed: reads anywhere, writes only on listed routes. */
export function judgeRelayRequest(method: string, path: string): RelayVerdict {
  const decoded = decodePath(path)
  if (decoded === undefined || decoded.split('/').includes('..')) return 'bad-request'
  if (READ_METHODS.has(method)) return 'allowed'
  const writable = WRITABLE_ROUTES.some(
    (route) => route.methods.has(method) && route.path.test(path),
  )
  return writable ? 'allowed' : 'method-not-allowed'
}

/**
 * `X-Forwarded-For` value for the API: the received chain, then the address that just connected.
 * Without it, per-address rate limits would be shared by all visitors.
 */
export function forwardedFor(
  incoming: string | undefined,
  peer: string | undefined,
): string | undefined {
  return [incoming, peer].filter(Boolean).join(', ') || undefined
}
