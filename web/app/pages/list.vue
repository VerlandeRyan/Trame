<script setup lang="ts">
import type { UiTab } from '~/components/ui/Tabs.vue'
import { LIBRARY_STATUSES, type LibraryEntryChanges, type LibraryStatus } from '~/utils/library'
import {
  countEntriesOfAllStatuses,
  LIST_SORTS,
  parseListQuery,
  toListRouteQuery,
  type ListedEntry,
  type ListSort,
  type ListState,
  type ListUnit,
  type ListView,
} from '~/utils/reading-list'

// Ma liste de lecture (US-07) : l'URL porte l'onglet de statut, la recherche, le tri et la vue.
definePageMeta({ middleware: 'authenticated' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const state = computed(() => parseListQuery(route.query))
const {
  isOpen: isAskingToRead,
  title: promptTitle,
  text: promptText,
  confirmLabel: promptConfirmLabel,
  cancelLabel: promptCancelLabel,
  request: requestPrompt,
  confirm: confirmPrompt,
  decline: declinePrompt,
} = useReadingPrompt()
const isNarrow = useNarrowScreen()
const searchPlaceholder = computed(() =>
  t(isNarrow.value ? 'list.searchPlaceholderShort' : 'list.searchPlaceholder'),
)
const list = await useReadingList(state)

useSeoMeta({ title: () => t('list.title'), robots: 'noindex, nofollow' })

// Les changements de filtre remplacent l'entrée d'historique : « Retour » quitte la liste.
function navigateToList(next: ListState) {
  return navigateTo({ path: localePath('/list'), query: toListRouteQuery(next) }, { replace: true })
}

const ALL_TAB = 'all'
const tabs = computed<UiTab[]>(() => [
  {
    id: ALL_TAB,
    label: t('list.tabAll'),
    count: countEntriesOfAllStatuses(list.statusCounts.value),
  },
  ...LIBRARY_STATUSES.map((status) => ({
    id: status,
    label: t(`readingStatus.${status}`),
    count: list.statusCounts.value[status],
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

// Recherche : on attend la fin de la frappe avant de changer l'adresse.
const SEARCH_DELAY_MS = 250
const searchText = ref(parseListQuery(route.query).q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void navigateToList({ ...state.value, q: parseListQuery({ q: searchText.value }).q })
  }, SEARCH_DELAY_MS)
}
onBeforeUnmount(() => clearTimeout(searchTimer))

// La grille compte les chapitres ou les tomes, au choix.
const unit = ref<ListUnit>('chapters')
const unitName = computed(() =>
  t(unit.value === 'chapters' ? 'list.unitChapter' : 'list.unitVolume'),
)

// Un changement peut demander une confirmation avant d'être enregistré ; si rien n'est enregistré,
// les compteurs relisent la vraie valeur.
const counterKey = ref(0)
function changeEntryOrAskFirst(item: ListedEntry, changes: LibraryEntryChanges) {
  const isAsking = requestPrompt(
    item.entry,
    { chapters: item.work.chapters, volumes: item.work.volumes },
    changes,
    {
      apply: (confirmed) => list.changeEntry(item, confirmed),
      discard: () => (counterKey.value += 1),
    },
  )
  if (!isAsking) void list.changeEntry(item, changes)
}

const editedWorkId = ref<number | null>(null)
// La fenêtre enregistre ce qu'on y a saisi ; seul un passage en « Terminé » peut proposer de
// mettre les compteurs aux totaux parus (les autres questions concernent les boutons +1).
function saveEditedEntry(changes: LibraryEntryChanges) {
  const item = list.items.value.find((each) => each.work.id === editedWorkId.value)
  if (!item) return
  if (changes.status === 'completed') changeEntryOrAskFirst(item, changes)
  else void list.changeEntry(item, changes)
}
const isEditing = computed({
  get: () => editedWorkId.value !== null,
  set: (open: boolean) => {
    if (!open) editedWorkId.value = null
  },
})
const editedItem = computed(
  () => list.items.value.find((item) => item.work.id === editedWorkId.value) ?? null,
)

// Liste vide : aucune œuvre au total, aucun filtre actif.
const isFilterActive = computed(() => state.value.status !== null || state.value.q !== '')
const isEmptyList = computed(
  () =>
    countEntriesOfAllStatuses(list.statusCounts.value) === 0 &&
    !isFilterActive.value &&
    !list.error.value,
)
const isLoading = computed(() => list.status.value === 'pending')

// Défilement continu : la suite se charge quand le bas de la liste approche.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
const isSentinelInView = () =>
  (sentinel.value?.getBoundingClientRect().top ?? Infinity) < innerHeight
// Une page de plus tant que le repère reste à l'écran (une page courte ne le fait pas sortir).
async function loadMoreWhileSentinelVisible(): Promise<void> {
  const canLoadMore = list.hasMore.value && !list.hasLoadMoreFailed.value && isSentinelInView()
  if (!canLoadMore) return
  await list.loadMore()
  return loadMoreWhileSentinelVisible()
}
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreWhileSentinelVisible()
    },
    { rootMargin: '300px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="list" :aria-busy="isLoading">
    <header class="list__head">
      <h1 class="list__title">{{ t('list.title') }}</h1>
      <ListViewToggle v-if="!isEmptyList" :view="state.view" @change="changeView" />
    </header>

    <div v-if="list.error.value && !list.items.value.length" class="list__problem" role="alert">
      <p>{{ t('list.loadError') }}</p>
      <UiButton data-testid="list-retry" @click="list.refresh()">{{ t('list.retry') }}</UiButton>
    </div>

    <!-- Maquette 09, état 3 : panneau blanc à ombre, texte resserré, sans icône. -->
    <UiPanel v-else-if="isEmptyList" class="list__empty" data-testid="list-empty">
      <h2 class="list__empty-title">{{ t('list.emptyTitle') }}</h2>
      <p class="list__empty-text">{{ t('list.emptyText') }}</p>
      <UiButton :href="localePath('/search')">{{ t('list.explore') }}</UiButton>
    </UiPanel>

    <template v-else>
      <ListSummary :totals="list.totals.value" />

      <UiTabs v-model="tab" :tabs="tabs" :label="t('list.tabsLabel')" class="list__tabs" />

      <div class="list__tools">
        <input
          v-model="searchText"
          type="search"
          class="list__search"
          :aria-label="t('list.searchLabel')"
          :placeholder="searchPlaceholder"
          data-testid="list-search"
          @input="onSearchInput"
        />
        <UiSelect
          v-model="sort"
          :options="sortOptions"
          :label="t('list.sortLabel')"
          trigger-test-id="list-sort"
          class="list__sort"
        />
      </div>

      <p v-if="list.errorKey.value" class="list__error" role="alert" data-testid="list-error">
        {{ t(list.errorKey.value) }}
      </p>

      <!-- Grille : le nombre d'œuvres à gauche, ce que la grille compte à droite, puis l'aide. -->
      <div v-if="state.view === 'grid'" class="list__grid-head">
        <div class="list__grid-bar">
          <p class="list__count" data-testid="list-count">
            {{ t('list.workCount', { count: list.total.value }, list.total.value) }}
          </p>
          <ListUnitToggle v-model="unit" />
        </div>
        <!-- Le glissement n'existe qu'au doigt : à la souris l'aide parle des boutons. -->
        <p v-if="list.items.value.length" class="list__hint" data-testid="list-grid-hint">
          <span class="list__hint-touch">{{ t('list.gridHint', { unit: unitName }) }}</span>
          <span class="list__hint-mouse">{{ t('list.gridHintMouse', { unit: unitName }) }}</span>
        </p>
      </div>

      <div class="list__results" :class="{ 'list__results--loading': isLoading }">
        <UiEmptyState
          v-if="!list.items.value.length"
          :title="t('list.noMatch')"
          :text="t('list.noMatchText')"
          data-testid="list-no-match"
        />

        <div v-else-if="state.view === 'grid'" class="list__grid" data-testid="list-grid">
          <ListGridItem
            v-for="item in list.items.value"
            :key="item.work.id"
            :item="item"
            :unit="unit"
            @change="changeEntryOrAskFirst(item, $event)"
          />
        </div>

        <div v-else class="list__table" data-testid="list-table">
          <div class="list__columns" aria-hidden="true">
            <span>{{ t('list.headerWork') }}</span>
            <span>{{ t('list.headerStatus') }}</span>
            <span class="list__column--center">{{ t('library.chaptersRead') }}</span>
            <span class="list__column--center">{{ t('library.volumesRead') }}</span>
            <span>{{ t('list.headerRating') }}</span>
            <span />
          </div>
          <ListRow
            v-for="item in list.items.value"
            :key="item.work.id"
            :item="item"
            :counter-key="counterKey"
            @change="changeEntryOrAskFirst(item, $event)"
            @edit="editedWorkId = item.work.id"
          />
        </div>
      </div>

      <div ref="sentinel" class="list__more" data-testid="list-more">
        <p v-if="list.hasMore.value" class="list__progress">
          {{ t('list.loadingMore', { loaded: list.items.value.length, total: list.total.value }) }}
        </p>
        <p v-if="list.hasLoadMoreFailed.value" class="list__error" role="alert">
          {{ t('list.loadMoreError') }}
        </p>
        <UiButton
          v-if="list.hasMore.value"
          variant="secondary"
          size="small"
          data-testid="list-load-more"
          @click="list.loadMore()"
        >
          {{ t('list.loadMore') }}
        </UiButton>
      </div>
    </template>

    <ListEditModal
      v-model="isEditing"
      :item="editedItem"
      @save="saveEditedEntry"
      @remove="editedItem && list.removeEntry(editedItem)"
    />

    <UiConfirm
      v-model="isAskingToRead"
      :title="promptTitle"
      :text="promptText"
      :confirm-label="promptConfirmLabel"
      :cancel-label="promptCancelLabel"
      :close-label="t('action.close')"
      @confirm="confirmPrompt"
      @cancel="declinePrompt"
    />
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// `minmax(0, 1fr)` : sans cela les pastilles de statut (sur une ligne) élargissent toute la page.
.list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

.list__empty {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.list__empty-title {
  color: var(--color-ink);
  font-size: 1.25rem;
}

.list__empty-text {
  max-width: 28rem;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.list__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list__title {
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.75rem;
}

// Pastilles de la maquette : basses, sans filet dessous ; 44 px au doigt seulement.
.list__tabs.list__tabs {
  padding-bottom: 0;
  scrollbar-width: none;
  overflow-x: auto;
  border-bottom: 0;

  :deep(.tabs__tab) {
    min-height: 32px;
    font-size: 0.8125rem;

    // Survol souris : simple changement de couleur, sans animation.
    @include on-hover {
      &:not(.tabs__tab--active) {
        background: var(--color-cover-empty);
      }
    }

    @media (pointer: coarse) {
      min-height: var(--touch);
    }
  }
}

// Une seule rangée au mobile : recherche, tri, bascule (maquette 10).
.list__tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);

  @media (min-width: 768px) {
    gap: var(--space-3);
  }
}

// Au mobile le tri se réduit à « Trier par ▾ » dans un cadre : la valeur reste lue, pas affichée.
.list__sort {
  flex: none;

  @media (max-width: 767px) {
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: var(--border);
    border-radius: var(--radius);
    background: var(--color-surface);

    // Tout le cadre ouvre le menu, pas seulement la flèche.
    :deep(.select__trigger)::before {
      position: absolute;
      inset: 0;
      content: '';
    }

    :deep(.select__value) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
}

// Champ de 16 px au minimum : Safari iOS ne zoome pas.
.list__search {
  flex: 1 1 0;
  min-width: 0;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 1rem;
}

.list__grid-head {
  display: grid;
  gap: var(--space-2);
}

.list__grid-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list__count {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 700;
}

// Appareil à souris : l'aide des boutons ; au doigt : celle du glissement.
.list__hint-mouse {
  display: none;

  @media (hover: hover) and (pointer: fine) {
    display: inline;
  }
}

.list__hint-touch {
  @media (hover: hover) and (pointer: fine) {
    display: none;
  }
}

.list__hint,
.list__progress {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.list__error {
  margin: 0;
  color: var(--color-crimson);
  font-size: 0.875rem;
  font-weight: 700;
}

.list__problem {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-weight: 700;
}

// Pendant le chargement, la liste précédente reste affichée, estompée.
.list__results--loading {
  opacity: 0.5;
}

.list__table {
  --list-columns: minmax(0, 1fr) 9rem 8.5rem 8.5rem 4.5rem 6.5rem;

  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.list__columns {
  display: none;

  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: var(--list-columns);
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border);
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    font-weight: 800;
  }
}

.list__column--center {
  text-align: center;
}

.list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  }
}

.list__more {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-height: 1px;
}
</style>
