// Dernière liste du catalogue consultée (onglet, recherche, filtres, page) : « Retour » et « Annuler »
// d'une fiche y ramènent, au lieu de repartir de l'onglet des œuvres.
export function useAdminListLocation() {
  const last = useState<AdminListQuery | null>('admin-last-list', () => null)
  const localePath = useLocalePath()
  const location = computed(() =>
    localePath({
      path: '/admin/catalogue',
      query: toAdminRouteQuery(last.value ?? parseAdminListQuery({})),
    }),
  )
  return { last, location }
}
