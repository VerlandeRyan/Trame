/** Hooks the administration client into Nuxt; `useApi()` forwards the visitor's cookie during server rendering. */
export function useAdminClient() {
  return createAdminClient(useApi().request)
}
