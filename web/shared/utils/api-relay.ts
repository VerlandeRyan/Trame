// Règles du relais `/api/v1/…` (`server/api/v1/[...path].ts`), dans `shared/` pour que le serveur
// les utilise sans import et que les tests les atteignent.
const READ_METHODS = new Set(['GET', 'HEAD'])
const WRITE_METHODS = new Set(['POST'])
// Une route d'écriture s'ajoute ici avec son ticket.
const WRITABLE_PREFIXES = ['auth/']

export type RelayVerdict = 'allowed' | 'bad-request' | 'method-not-allowed'

export function judgeRelayRequest(method: string, path: string): RelayVerdict {
  if (path.split('/').includes('..')) return 'bad-request'
  if (READ_METHODS.has(method)) return 'allowed'
  const writable = WRITE_METHODS.has(method) && WRITABLE_PREFIXES.some((p) => path.startsWith(p))
  return writable ? 'allowed' : 'method-not-allowed'
}

/**
 * Valeur de `X-Forwarded-For` pour l'API : la chaîne reçue, puis l'adresse qui vient de se
 * connecter. Sans elle, les limites de débit par adresse seraient partagées par tous les visiteurs.
 */
export function forwardedFor(incoming: string | undefined, peer: string | undefined): string | undefined {
  return [incoming, peer].filter(Boolean).join(', ') || undefined
}
