<script setup lang="ts">
import {
  activeFilters,
  activeQuery,
  changeSort,
  filterValueLabel,
  hasSearchText,
  parseSearchQuery,
  resetFilters,
  SORTS,
  toApiQuery,
  toRouteQuery,
  toggleFilter,
  totalPages,
  type FilterKey,
  type SearchSort,
  type SearchState,
  type WorkFacets,
  type WorkPage,
} from '~/utils/search'

/** Results page: the address carries the search, the filters, the sort and the page. */
const route = useRoute()
const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const api = useApi()

const state = computed(() => parseSearchQuery(route.query))
// Without text (or under 2 characters), the page lists the catalogue.
const query = computed(() => activeQuery(state.value))

/** Results and counts of one search. */
interface SearchData {
  works: WorkPage
  facets: WorkFacets
  /** Text of these results (the heading follows the displayed list). */
  query: string
}

/** Identifier of the current search: address and language. */
const searchKey = () => `${locale.value}|${route.fullPath}`

/** Loads the results and the facet counts, starting over if the search changed meanwhile. */
async function loadSearch(): Promise<SearchData> {
  const requested = searchKey()
  const current = state.value
  const [works, facets] = await Promise.all([
    api.request<WorkPage>('/works', {
      query: toApiQuery(current, { lang: locale.value, page: true }),
    }),
    api.request<WorkFacets>('/works/facets', {
      query: toApiQuery(current, { lang: locale.value }),
    }),
  ])
  // Search changed during the call (fast typing): start over for the latest one.
  if (searchKey() !== requested) return loadSearch()
  if (!works.approximate) return { works, facets, query: activeQuery(current) }
  // Approximate list: the counts follow it.
  const approximateFacets = await api.request<WorkFacets>('/works/facets', {
    query: { ...toApiQuery(current, { lang: locale.value }), match: 'any' },
  })
  if (searchKey() !== requested) return loadSearch()
  return { works, facets: approximateFacets, query: activeQuery(current) }
}

// The language is in the key and in the sources: changing language recreates the page, whereas
// a shared key kept the old handler (the list was no longer reloaded).
const { data, error, status, refresh } = await useAsyncData<SearchData>(
  `search-${locale.value}`,
  loadSearch,
  { watch: [() => route.fullPath, locale] },
)

// noindex: a results page has no content of its own; search engines index the work pages.
useSeoMeta({
  title: () =>
    query.value === '' ? t('search.title') : t('search.titleWithQuery', { query: query.value }),
  robots: 'noindex, follow',
})

/** Goes to a search state; filter, sort and reset replace the history entry, so "Back" leaves the search. */
async function navigateToSearch(
  next: SearchState,
  options: { replace?: boolean } = {},
): Promise<void> {
  await navigateTo(
    { path: localePath('/search'), query: toRouteQuery(next) },
    { replace: options.replace },
  )
}

// While loading, the previous list stays displayed, faded.
const loading = computed(() => status.value === 'pending')

const filtersOpen = ref(false)
const sheetFilters = ref<{ allOpen: boolean; setAll: (open: boolean) => void } | null>(null)

// The sheet only exists on mobile: it closes when switching to desktop.
let desktopQuery: MediaQueryList | undefined
/** Closes the filter sheet when the screen becomes desktop-sized. */
function closeSheetOnDesktop(event: MediaQueryListEvent) {
  if (event.matches) filtersOpen.value = false
}

onMounted(() => {
  desktopQuery = window.matchMedia?.('(min-width: 768px)')
  desktopQuery?.addEventListener('change', closeSheetOnDesktop)
})
onBeforeUnmount(() => desktopQuery?.removeEventListener('change', closeSheetOnDesktop))

const pages = computed(() => totalPages(data.value?.works.total ?? 0, data.value?.works.pageSize))
const total = computed(() => data.value?.works.total ?? 0)

// A page beyond the last one: go to the last one.
watch(
  data,
  (loaded) => {
    const beyondLastPage =
      loaded !== undefined &&
      loaded.works.total > 0 &&
      loaded.works.items.length === 0 &&
      state.value.page > pages.value
    if (beyondLastPage)
      void navigateToSearch({ ...state.value, page: pages.value }, { replace: true })
  },
  { immediate: true },
)
/** Selected filter values, shown as removable chips. */
const chips = computed(() => activeFilters(state.value))

/** Translated label of a filter value. */
const labelOf = (key: FilterKey, code: string) => filterValueLabel(t, te, key, code)

/** Sort choices; relevance only exists with search text. */
const sortOptions = computed(() =>
  SORTS.filter((sort) => sort !== 'relevance' || hasSearchText(state.value.q)).map((sort) => ({
    value: sort,
    label: t(`search.sort.${sort}`),
  })),
)

/** Applies a new sort. */
function onSortChange(value: string) {
  return navigateToSearch(changeSort(state.value, value as SearchSort), { replace: true })
}

/** Address of a results page. */
function linkFor(page: number) {
  return { path: localePath('/search'), query: toRouteQuery({ ...state.value, page }) }
}

// The heading follows the displayed list, not the address (which changes before results arrive).
const heading = computed(() => {
  const shown = data.value?.query ?? ''
  if (total.value === 0) {
    return shown === '' ? t('search.noResultFilters') : t('search.noResultFor', { query: shown })
  }
  return shown === ''
    ? t('search.resultCountFiltered', total.value)
    : t('search.resultCount', { count: total.value, query: shown }, total.value)
})

const hasFilterColumn = computed(() => total.value > 0 || chips.value.length > 0)
</script>

<template>
  <div class="search-page">
    <LayoutSearchBox class="search-page__field" />

    <UiStatePanel
      v-if="error"
      tone="error"
      :title="t('search.title')"
      :text="t('search.loadError')"
    >
      <UiButton variant="primary" data-testid="search-retry" @click="refresh()">
        {{ t('search.retry') }}
      </UiButton>
    </UiStatePanel>

    <template v-else-if="data">
      <div class="search-page__layout" :class="{ 'search-page__layout--single': !hasFilterColumn }">
        <aside v-if="hasFilterColumn" class="search-page__filters">
          <SearchFilters
            :facets="data.facets"
            :filters="state.filters"
            @toggle="
              (key, code) => navigateToSearch(toggleFilter(state, key, code), { replace: true })
            "
            @reset="navigateToSearch(resetFilters(state), { replace: true })"
          />
        </aside>

        <section
          class="search-page__results"
          :class="{ 'search-page__results--loading': loading }"
          :aria-busy="loading"
        >
          <header class="search-page__head">
            <!-- Only the number of results is announced to screen readers. -->
            <h1 class="search-page__count" aria-live="polite" data-testid="search-count">
              {{ heading }}
            </h1>
          </header>
          <UiRule class="search-page__rule" />
          <p
            v-if="data.works.approximate"
            class="search-page__approximate"
            data-testid="search-approximate"
          >
            {{ t('search.approximate') }}
          </p>

          <ul v-if="chips.length > 0" class="search-page__filterbar">
            <li v-for="chip in chips" :key="`${chip.key}-${chip.code}`">
              <button
                type="button"
                class="search-page__chip"
                :aria-label="t('search.removeFilter', { label: labelOf(chip.key, chip.code) })"
                @click="
                  navigateToSearch(toggleFilter(state, chip.key, chip.code), { replace: true })
                "
              >
                {{ labelOf(chip.key, chip.code) }}
                <Icon name="tabler:x" size="12" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <!-- 'Filters (n)' (mobile) and sort, same size side by side. -->
          <div v-if="hasFilterColumn" class="search-page__toolbar">
            <UiButton
              variant="secondary"
              size="small"
              class="search-page__filters-button"
              @click="filtersOpen = true"
            >
              {{
                chips.length > 0
                  ? t('search.filtersCount', { count: chips.length })
                  : t('search.filters')
              }}
              <Icon name="tabler:adjustments-horizontal" size="16" aria-hidden="true" />
            </UiButton>
            <UiSelect
              v-if="total > 0"
              boxed
              :model-value="state.sort"
              :options="sortOptions"
              :label="t('search.sortLabel')"
              trigger-test-id="search-sort"
              @update:model-value="onSortChange"
            />
          </div>

          <UiStatePanel
            v-if="total === 0"
            :title="
              chips.length > 0 && query === ''
                ? t('search.noResultFilters')
                : t('search.noResultTitle')
            "
            :text="t('search.noResultText')"
            class="search-page__empty"
            data-testid="search-empty"
          >
            <!-- Inactive until proposing a work exists. -->
            <UiButton variant="primary" disabled data-testid="search-propose">
              {{ t('search.proposeSignIn') }}
            </UiButton>
          </UiStatePanel>

          <UiPanel v-else class="search-page__list">
            <ul class="search-page__items">
              <li v-for="work in data.works.items" :key="work.id">
                <SearchResultItem :work="work" />
              </li>
            </ul>
          </UiPanel>
          <UiPagination
            v-if="total > 0"
            class="search-page__pagination"
            :page="state.page"
            :pages="pages"
            :link-for="linkFor"
          />
        </section>
      </div>

      <!-- Mobile filter sheet. -->
      <UiModal
        v-model="filtersOpen"
        placement="bottom"
        :title="t('search.filters')"
        :close-label="t('search.close')"
      >
        <template #actions>
          <button
            type="button"
            class="search-page__sheet-collapse link-underlined"
            data-testid="sheet-collapse"
            @click="sheetFilters?.setAll(!sheetFilters.allOpen)"
          >
            {{ sheetFilters?.allOpen ? t('search.collapseAll') : t('search.expandAll') }}
          </button>
        </template>
        <SearchFilters
          ref="sheetFilters"
          sheet
          :facets="data.facets"
          :filters="state.filters"
          @toggle="
            (key, code) => navigateToSearch(toggleFilter(state, key, code), { replace: true })
          "
        />
        <template #footer>
          <UiButton
            variant="secondary"
            class="search-page__sheet-reset"
            data-testid="sheet-reset"
            @click="navigateToSearch(resetFilters(state), { replace: true })"
          >
            {{ t('search.reset') }}
          </UiButton>
          <UiButton
            variant="primary"
            class="search-page__sheet-apply"
            data-testid="sheet-apply"
            @click="filtersOpen = false"
          >
            {{ t('search.viewResults', { count: total }, total) }}
          </UiButton>
        </template>
      </UiModal>
    </template>
  </div>
</template>

<style scoped lang="scss">
.search-page {
  display: grid;
  gap: var(--space-4);
}

// The page's field only exists on mobile (on desktop the header's is enough).
.search-page__field {
  @media (min-width: 768px) {
    display: none;
  }
}

.search-page__layout {
  display: grid;
  gap: var(--space-4);

  // Without a filter column, the content takes the full width.
  @media (min-width: 768px) {
    grid-template-columns: 210px minmax(0, 1fr);
    align-items: start;
    gap: 28px;

    &.search-page__layout--single {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}

.search-page__approximate {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.search-page__pagination {
  margin-top: 16px;
}

// Filters: a sheet on mobile, a left column on desktop (it scrolls with the page).
.search-page__filters {
  display: none;

  @media (min-width: 768px) {
    display: block;
  }
}

.search-page__results {
  min-width: 0;
}

.search-page__results--loading {
  opacity: 0.55;
  transition: opacity 0.15s;
}

@media (prefers-reduced-motion: reduce) {
  .search-page__results--loading {
    transition: none;
  }
}

.search-page__count {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;

  @media (min-width: 768px) {
    font-size: 1.125rem;
  }
}

.search-page__rule {
  --rule-gap: 10px;
}

.search-page__filterbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  padding: 0;
}

// Like the admin catalogue: 'Filters' on the left, sort on the right (mobile); sort alone on the right (desktop).
.search-page__toolbar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);

  @media (min-width: 768px) {
    justify-content: flex-end;
  }
}

// Desktop first: the mobile button must never show, even before all styles are loaded.
// `.search-page__toolbar` is added to win over `UiButton`'s `display`.
.search-page__toolbar .search-page__filters-button {
  display: none;
}

@media (max-width: 767px) {
  .search-page__toolbar .search-page__filters-button {
    display: inline-flex;
    min-height: var(--touch);
  }
}

// 44 px touch area through the pseudo-element.
.search-page__chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-chip);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    inset: -11px -4px;
  }
}

.search-page__list {
  padding: 0;
}

.search-page__items {
  margin: 0;
  padding: 0;

  > li + li {
    border-top: 1px dashed var(--color-rule);
  }
}

.search-page__empty {
  width: 100%;
  max-width: 780px;
  margin: var(--space-6) auto 0;
}

// 'Collapse all' in the sheet header; 44 px touch area.
.search-page__sheet-collapse {
  min-height: var(--touch);
  padding: 0 var(--space-1);
  border: 0;
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

// Sheet footer: 'Reset' 1/3, 'See N results' 2/3.
.search-page__sheet-reset {
  flex: 1;
}

.search-page__sheet-apply {
  flex: 2;
}
</style>
