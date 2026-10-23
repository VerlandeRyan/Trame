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

// Page de résultats : l'URL porte la recherche, les filtres, le tri et la page.
const route = useRoute()
const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const api = useApi()

const state = computed(() => parseSearchQuery(route.query))
// Sans texte (ou moins de 2 caractères), la page liste le catalogue.
const query = computed(() => activeQuery(state.value))

interface SearchData {
  works: WorkPage
  facets: WorkFacets
  /** Texte de ces résultats (le titre suit la liste affichée). */
  query: string
}

// Adresse + langue : identifie la recherche en cours.
const searchKey = () => `${locale.value}|${route.fullPath}`

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
  // Recherche changée pendant l'appel (frappe rapide) : on recommence pour la dernière.
  if (searchKey() !== requested) return loadSearch()
  if (!works.approximate) return { works, facets, query: activeQuery(current) }
  // Liste approchante : les compteurs la suivent.
  const approximateFacets = await api.request<WorkFacets>('/works/facets', {
    query: { ...toApiQuery(current, { lang: locale.value }), match: 'any' },
  })
  if (searchKey() !== requested) return loadSearch()
  return { works, facets: approximateFacets, query: activeQuery(current) }
}

// La langue est dans la clé et dans les sources : changer de langue recrée la page, et une clé
// partagée gardait l'ancien gestionnaire (la liste n'était plus rechargée).
const { data, error, status, refresh } = await useAsyncData<SearchData>(
  `search-${locale.value}`,
  loadSearch,
  { watch: [() => route.fullPath, locale] },
)

// noindex : page de résultats sans contenu propre ; les moteurs indexent les fiches œuvres.
useSeoMeta({
  title: () =>
    query.value === '' ? t('search.title') : t('search.titleWithQuery', { query: query.value }),
  robots: 'noindex, follow',
})

// Filtre, tri et réinitialisation remplacent l'entrée d'historique : « Retour » quitte la recherche.
async function navigateToSearch(
  next: SearchState,
  options: { replace?: boolean } = {},
): Promise<void> {
  await navigateTo(
    { path: localePath('/search'), query: toRouteQuery(next) },
    { replace: options.replace },
  )
}

// Pendant le chargement, la liste précédente reste affichée, estompée.
const loading = computed(() => status.value === 'pending')

const filtersOpen = ref(false)
const sheetFilters = ref<{ allOpen: boolean; setAll: (open: boolean) => void } | null>(null)

// La feuille n'existe qu'au mobile : on la ferme en passant au bureau.
let desktopQuery: MediaQueryList | undefined
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

// Page au-delà de la dernière : on rejoint la dernière.
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
const chips = computed(() => activeFilters(state.value))

const labelOf = (key: FilterKey, code: string) => filterValueLabel(t, te, key, code)

const sortOptions = computed(() =>
  SORTS.filter((sort) => sort !== 'relevance' || hasSearchText(state.value.q)).map((sort) => ({
    value: sort,
    label: t(`search.sort.${sort}`),
  })),
)

function onSortChange(value: string) {
  return navigateToSearch(changeSort(state.value, value as SearchSort), { replace: true })
}

function linkFor(page: number) {
  return { path: localePath('/search'), query: toRouteQuery({ ...state.value, page }) }
}

// Le titre suit la liste affichée, pas l'adresse (qui change avant l'arrivée des résultats).
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

    <UiEmptyState v-if="error" :title="t('search.title')" :text="t('search.loadError')">
      <UiButton variant="primary" data-testid="search-retry" @click="refresh()">
        {{ t('search.retry') }}
      </UiButton>
    </UiEmptyState>

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
            <!-- Seul le nombre de résultats est annoncé aux lecteurs d'écran. -->
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

          <!-- Pastilles des filtres actifs, puis « Filtres (n) » à droite (mobile). -->
          <ul
            class="search-page__filterbar"
            :class="{ 'search-page__filterbar--empty': chips.length === 0 }"
          >
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
            <li v-if="hasFilterColumn" class="search-page__filters-item">
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
            </li>
          </ul>

          <div v-if="total > 0" class="search-page__toolbar">
            <UiSelect
              :model-value="state.sort"
              :options="sortOptions"
              :label="t('search.sortLabel')"
              trigger-test-id="search-sort"
              @update:model-value="onSortChange"
            />
          </div>

          <UiPanel v-if="total === 0" class="search-page__empty" data-testid="search-empty">
            <h2 class="search-page__empty-title">
              {{
                chips.length > 0 && query === ''
                  ? t('search.noResultFilters')
                  : t('search.noResultTitle')
              }}
            </h2>
            <p class="search-page__empty-text">{{ t('search.noResultText') }}</p>
            <!-- Inactif jusqu'à US-09. -->
            <UiButton variant="primary" disabled data-testid="search-propose">
              {{ t('search.proposeSignIn') }}
            </UiButton>
          </UiPanel>

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

      <!-- Feuille de filtres du mobile. -->
      <UiModal
        v-model="filtersOpen"
        placement="bottom"
        :title="t('search.filters')"
        :close-label="t('search.close')"
      >
        <template #actions>
          <button
            type="button"
            class="search-page__sheet-collapse"
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

// Le champ de la page n'existe qu'au mobile (au bureau, celui de l'en-tête suffit).
.search-page__field {
  @media (min-width: 768px) {
    display: none;
  }
}

.search-page__layout {
  display: grid;
  gap: var(--space-4);

  // Sans colonne de filtres, le contenu prend toute la largeur.
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

// Filtres : feuille au mobile, colonne à gauche au bureau (elle défile avec la page).
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

// Ligne des filtres actifs ; masquée au bureau quand il n'y en a pas.
.search-page__filterbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-1);
  padding: 0;

  @media (min-width: 768px) {
    &.search-page__filterbar--empty {
      display: none;
    }
  }
}

// « Filtres » reste à droite ; absent au bureau.
.search-page__filters-item {
  margin-left: auto;

  @media (min-width: 768px) {
    display: none;
  }
}

.search-page__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-1);
}

.search-page__filters-button {
  min-height: 36px;
  padding: 0 10px;
  font-size: 0.875rem;

  @media (min-width: 768px) {
    display: none;
  }
}

// Zone tactile de 44 px via le pseudo-élément.
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

// Carte « aucun résultat » centrée.
.search-page__empty {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 780px;
  margin: var(--space-6) auto 0;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.search-page__empty-title {
  font-size: 1.25rem;
}

.search-page__empty-text {
  max-width: 420px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

// « Tout replier » dans l'en-tête de la feuille ; zone tactile de 44 px.
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

// Pied de la feuille : « Réinitialiser » 1/3, « Voir N résultats » 2/3.
.search-page__sheet-reset {
  flex: 1;
}

.search-page__sheet-apply {
  flex: 2;
}
</style>
