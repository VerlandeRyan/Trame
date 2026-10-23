import type { UiTab } from '~/components/ui/Tabs.vue'
import { LIBRARY_STATUSES, type LibraryStatus } from '~/utils/library'
import {
  countEntriesOfAllStatuses,
  LIST_SORTS,
  parseListQuery,
  toListRouteQuery,
  type ListSort,
  type ListState,
  type ListView,
  type StatusCounts,
} from '~/utils/reading-list'

const ALL_TAB = 'all'
const SEARCH_DELAY_MS = 250

/**
 * Commandes d'une page de liste de lecture, toutes portées par l'adresse `path` : onglets de
 * statut, tri, vue et recherche (appliquée une fois la frappe finie).
 */
export function useListControls(
  state: ComputedRef<ListState>,
  statusCounts: Readonly<Ref<StatusCounts>>,
  path: string,
) {
  const route = useRoute()
  const { t } = useI18n()
  const localePath = useLocalePath()

  // Les changements remplacent l'entrée d'historique : « Retour » quitte la liste.
  async function navigateToList(next: ListState): Promise<void> {
    await navigateTo({ path: localePath(path), query: toListRouteQuery(next) }, { replace: true })
  }

  const tabs = computed<UiTab[]>(() => [
    { id: ALL_TAB, label: t('list.tabAll'), count: countEntriesOfAllStatuses(statusCounts.value) },
    ...LIBRARY_STATUSES.map((status) => ({
      id: status,
      label: t(`readingStatus.${status}`),
      count: statusCounts.value[status],
      status,
    })),
  ])
  const tab = computed({
    get: () => state.value.status ?? ALL_TAB,
    set: (id: string) => {
      const status = id === ALL_TAB ? null : (id as LibraryStatus)
      void navigateToList({ ...state.value, status })
    },
  })

  const sortOptions = computed(() =>
    LIST_SORTS.map((sort) => ({ value: sort, label: t(`list.sort.${sort}`) })),
  )
  const sort = computed({
    get: () => state.value.sort,
    set: (value: string) => {
      void navigateToList({ ...state.value, sort: value as ListSort })
    },
  })

  function changeView(view: ListView) {
    void navigateToList({ ...state.value, view })
  }

  const searchText = ref(parseListQuery(route.query).q)
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  function onSearchInput() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      void navigateToList({ ...state.value, q: parseListQuery({ q: searchText.value }).q })
    }, SEARCH_DELAY_MS)
  }
  onBeforeUnmount(() => clearTimeout(searchTimer))

  return { tabs, tab, sortOptions, sort, changeView, searchText, onSearchInput }
}
