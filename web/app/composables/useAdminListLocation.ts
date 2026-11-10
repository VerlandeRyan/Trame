/**
 * Last catalogue list visited (tab, search, filters, page): "Back" and "Cancel" on a record
 * return to it, instead of starting again from the works tab.
 */
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
