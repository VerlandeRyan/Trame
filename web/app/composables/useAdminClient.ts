// Branche le client d'administration sur Nuxt ; `useApi()` transmet le cookie du visiteur au rendu serveur.
export function useAdminClient() {
  return createAdminClient(useApi().request)
}
