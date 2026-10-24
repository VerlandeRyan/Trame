// Branche le client d'administration sur Nuxt ; le rendu serveur transmet le cookie du visiteur.
export function useAdminClient() {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  return createAdminClient(useApi().request, headers)
}
