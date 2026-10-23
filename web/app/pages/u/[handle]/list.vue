<script setup lang="ts">
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
} from '~/utils/reading-list'

// Liste de lecture d'un membre, en lecture seule (US-08) : la page « Ma liste » sans aucune
// modification. Un profil privé n'est pas lisible : la page le dit au lieu de lister.
// Son propre profil ouvre « Ma liste de lecture » (modifiable), avec la même adresse (onglet, tri…).
definePageMeta({
  middleware: (to) => {
    const { state } = useAuth()
    const isOwnList =
      state.value.status === 'authenticated' &&
      state.value.user.handle.toLowerCase() === String(to.params.handle).toLowerCase()
    if (!isOwnList) return
    return navigateTo({ path: useLocalePath()('/list'), query: to.query }, { replace: true })
  },
})

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const handle = String(route.params.handle ?? '')
const profilePath = localePath(`/u/${handle}`)
const state = computed(() => parseListQuery(route.query))
const list = await useReadingList(state, `/users/${encodeURIComponent(handle)}/entries`)

const failureStatus = computed(
  () => (list.error.value as { statusCode?: number } | undefined)?.statusCode,
)
const isPrivate = computed(() => failureStatus.value === 403)
// Un membre inconnu (ou un pseudo mal formé) est une page 404, comme son profil.
function failIfMemberUnknown() {
  if (failureStatus.value === 404 || failureStatus.value === 400) {
    throw createError({ statusCode: 404, fatal: true })
  }
}
failIfMemberUnknown()

useSeoMeta({ title: () => t('profile.list.title', { handle }), robots: 'noindex, nofollow' })

function navigateToList(next: ListState) {
  return navigateTo(
    { path: localePath(`/u/${handle}/list`), query: toListRouteQuery(next) },
    { replace: true },
  )
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

// Recherche : on attend la fin de la frappe avant de changer l'adresse (comme « Ma liste »).
const SEARCH_DELAY_MS = 250
const isNarrow = useNarrowScreen()
const searchPlaceholder = computed(() =>
  t(isNarrow.value ? 'list.searchPlaceholderShort' : 'profile.list.searchPlaceholder'),
)
const searchText = ref(parseListQuery(route.query).q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void navigateToList({ ...state.value, q: parseListQuery({ q: searchText.value }).q })
  }, SEARCH_DELAY_MS)
}
onBeforeUnmount(() => clearTimeout(searchTimer))

const unit = ref<'chapters' | 'volumes'>('chapters')
const isLoading = computed(() => list.status.value === 'pending')
const isEmpty = computed(
  () =>
    countEntriesOfAllStatuses(list.statusCounts.value) === 0 &&
    state.value.status === null &&
    !list.error.value,
)

// Défilement continu comme « Ma liste » : la suite se charge quand le bas de la liste approche.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
const isSentinelInView = () =>
  (sentinel.value?.getBoundingClientRect().top ?? Infinity) < innerHeight
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
  <div class="member-list" :aria-busy="isLoading" data-testid="member-list">
    <header class="member-list__head">
      <div>
        <NuxtLink :to="profilePath" class="member-list__back" data-testid="member-list-back">
          {{ t('profile.list.back') }}
        </NuxtLink>
        <h1 class="member-list__title">{{ t('profile.list.title', { handle }) }}</h1>
      </div>
      <ListViewToggle v-if="!isPrivate && !isEmpty" :view="state.view" @change="changeView" />
    </header>

    <UiPanel v-if="isPrivate" class="member-list__notice" data-testid="member-list-private">
      <Icon name="tabler:lock" size="32" aria-hidden="true" />
      <h2>{{ t('profile.private.title') }}</h2>
      <p>{{ t('profile.private.text') }}</p>
    </UiPanel>

    <div
      v-else-if="list.error.value && !list.items.value.length"
      class="member-list__notice"
      role="alert"
    >
      <p>{{ t('list.loadError') }}</p>
      <UiButton @click="list.refresh()">{{ t('list.retry') }}</UiButton>
    </div>

    <UiPanel v-else-if="isEmpty" class="member-list__notice" data-testid="member-list-empty">
      <p>{{ t('profile.list.empty') }}</p>
    </UiPanel>

    <template v-else>
      <ListSummary :totals="list.totals.value" />
      <UiTabs v-model="tab" :tabs="tabs" :label="t('list.tabsLabel')" class="member-list__tabs" />

      <div class="member-list__tools">
        <input
          v-model="searchText"
          type="search"
          class="member-list__search"
          :aria-label="t('profile.list.searchLabel')"
          :placeholder="searchPlaceholder"
          data-testid="member-list-search"
          @input="onSearchInput"
        />
        <UiSelect
          v-model="sort"
          :options="sortOptions"
          :label="t('list.sortLabel')"
          trigger-test-id="member-list-sort"
          class="member-list__sort"
        />
      </div>

      <div v-if="state.view === 'grid'" class="member-list__grid-bar">
        <p class="member-list__count" data-testid="member-list-count">
          {{ t('list.workCount', { count: list.total.value }, list.total.value) }}
        </p>
        <ListUnitToggle v-model="unit" />
      </div>

      <UiEmptyState
        v-if="!list.items.value.length"
        :title="t('list.noMatch')"
        :text="t('list.noMatchText')"
      />
      <div
        v-else-if="state.view === 'grid'"
        class="member-list__grid"
        data-testid="member-list-grid"
      >
        <ListGridItem
          v-for="item in list.items.value"
          :key="item.work.id"
          :item="item"
          :unit="unit"
          is-read-only
        />
      </div>
      <div v-else class="member-list__table" data-testid="member-list-table">
        <div class="member-list__columns" aria-hidden="true">
          <span>{{ t('list.headerWork') }}</span>
          <span>{{ t('list.headerStatus') }}</span>
          <span class="member-list__center">{{ t('library.chaptersRead') }}</span>
          <span class="member-list__center">{{ t('library.volumesRead') }}</span>
          <span>{{ t('list.headerRating') }}</span>
        </div>
        <ListRow v-for="item in list.items.value" :key="item.work.id" :item="item" is-read-only />
      </div>

      <div ref="sentinel" class="member-list__more" data-testid="member-list-more">
        <p v-if="list.hasMore.value" class="member-list__progress">
          {{ t('list.loadingMore', { loaded: list.items.value.length, total: list.total.value }) }}
        </p>
        <p v-if="list.hasLoadMoreFailed.value" class="member-list__progress" role="alert">
          {{ t('list.loadMoreError') }}
        </p>
        <UiButton
          v-if="list.hasMore.value"
          variant="secondary"
          size="small"
          data-testid="member-list-load-more"
          @click="list.loadMore()"
        >
          {{ t('list.loadMore') }}
        </UiButton>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// `minmax(0, 1fr)` : sans cela les pastilles de statut (sur une ligne) élargissent toute la page.
.member-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

// Une seule rangée au mobile comme « Ma liste » : le titre se resserre, la bascule reste à droite.
.member-list__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);

  > :first-child {
    flex: 1;
    min-width: 0;
  }
}

// Lien discret en encre souligné, à l'écart du titre bleu pour ne pas se confondre avec lui.
.member-list__back {
  display: inline-block;
  margin-bottom: var(--space-3);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;

  @include on-hover {
    color: var(--color-blue);
  }
}

.member-list__title {
  margin: 0;
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.25rem;
  overflow-wrap: anywhere;

  @media (min-width: 768px) {
    font-size: 1.75rem;
  }
}

.member-list__notice {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

// Pastilles de statut basses, comme « Ma liste » : sans filet dessous, 44 px au doigt seulement.
.member-list__tabs.member-list__tabs {
  padding-bottom: 0;
  scrollbar-width: none;
  overflow-x: auto;
  border-bottom: 0;

  :deep(.tabs__tab) {
    min-height: 32px;
    font-size: 0.8125rem;

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

// Recherche et tri sur une rangée, comme « Ma liste ».
.member-list__tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);

  @media (min-width: 768px) {
    gap: var(--space-3);
  }
}

// Champ de 16 px au minimum : Safari iOS ne zoome pas.
.member-list__search {
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

// Au mobile le tri se réduit à « Trier par ▾ » dans un cadre.
.member-list__sort {
  flex: none;

  @media (max-width: 767px) {
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: var(--border);
    border-radius: var(--radius);
    background: var(--color-surface);

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

.member-list__grid-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.member-list__count {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 700;
}

.member-list__table {
  --list-columns: minmax(0, 1fr) 9rem 8.5rem 8.5rem 4.5rem 0;

  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.member-list__columns {
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

.member-list__center {
  text-align: center;
}

.member-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  }
}

.member-list__more {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
}

.member-list__progress {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}
</style>
