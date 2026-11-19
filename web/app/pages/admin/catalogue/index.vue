<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * Administration catalogue: the address carries the tab, the search, the filters, the sort and
 * the page. Each tab has its own search.
 */
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()
const api = useApi()
const client = useAdminClient()
const { last: lastList } = useAdminListLocation()
useSeoMeta({ title: () => t('admin.catalogue.title'), robots: 'noindex, nofollow' })

const query = computed(() => parseAdminListQuery(route.query))
// A record opened from this list leads back to it, with the same tab, search and filters.
watch(query, (value) => (lastList.value = value), { immediate: true })

// The four reads are independent: they start together and the page waits for the slowest.
const [
  { data: page, refresh },
  // Number of archives of the current kind, shown on the "Archives" tab.
  { data: archivesCount, refresh: refreshArchivesCount },
  // Drafts to finish, per kind, announced above the list.
  { data: draftCounts },
  // Formats offered to the work filter.
  { data: genres },
] = await Promise.all([
  useAsyncData(
    () => `admin-${JSON.stringify(query.value)}`,
    () => client.list(query.value),
    { watch: [query] },
  ),
  useAsyncData(
    () => `admin-archives-${query.value.kind}`,
    async () => {
      const archives = {
        ...parseAdminListQuery({ kind: query.value.kind }),
        scope: 'archived' as const,
      }
      return (await client.list(archives, 1)).total
    },
    { watch: [() => query.value.kind] },
  ),
  useAsyncData('admin-draft-counts', () => client.draftCounts()),
  useAsyncData('admin-formats', () =>
    api.request<{ items: { code: string; category: string }[] }>('/genres'),
  ),
])
const formatCodes = computed(
  () => genres.value?.items.filter((genre) => genre.category === 'format').map((g) => g.code) ?? [],
)

const tabs = computed(() =>
  ADMIN_TABS.map((id) => ({
    id,
    label: t(id === 'archives' ? 'admin.scope.archived' : `admin.kind.${id}`),
    count: id === 'archives' ? (archivesCount.value ?? undefined) : undefined,
  })),
)
const tabModel = computed({
  get: () => tabOf(query.value),
  set: (tab) => go(queryForTab(query.value, tab as AdminTab)),
})
const kindOptions = computed(() => optionsOf(ADMIN_KINDS, (kind) => t(`admin.kind.${kind}`)))
const kindModel = computed({
  get: () => query.value.kind,
  set: (kind) => go({ ...queryForTab(query.value, 'archives'), kind: kind as AdminKind }),
})

/** Applies a publication state and goes back to the first page. */
const changeState = (state: AdminState) => go({ ...query.value, state, page: 1 })
/** Clears the state and the work filters. */
const resetFilters = () => go({ ...query.value, ...NO_FILTERS, state: 'all', page: 1 })
/** The kinds that have drafts to finish, with their number. */
const draftKinds = computed(() =>
  ADMIN_KINDS.map((kind) => ({ kind, count: draftCounts.value?.[kind] ?? 0 })).filter(
    ({ count }) => count > 0,
  ),
)
const draftTotal = computed(() => draftKinds.value.reduce((sum, { count }) => sum + count, 0))
/** Shows the drafts of one kind. */
const showDrafts = (kind: AdminKind) => go({ ...queryForTab(query.value, kind), state: 'draft' })

/** Navigates to a list query. */
function go(next: AdminListQuery) {
  return router.push({ query: toAdminRouteQuery(next) })
}
/** The work filters currently applied. */
const filters = computed<AdminWorkFilters>(() => ({
  type: query.value.type,
  status: query.value.status,
  format: query.value.format,
}))
/** Applies new filters and goes back to the first page. */
const changeFilters = (filters: AdminWorkFilters) => go({ ...query.value, ...filters, page: 1 })
/** Applies a new sort and goes back to the first page. */
const changeSort = (sort: AdminWorkSort) => go({ ...query.value, sort, page: 1 })
/** Address of a page of the list. */
const linkFor = (target: number): RouteLocationRaw => ({
  query: toAdminRouteQuery({ ...query.value, page: target }),
})

// Search: applied while typing after a short pause, or on Enter.
const SEARCH_DELAY_MS = 300
const searchText = ref(parseAdminListQuery(route.query).q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
/** Applies the typed search, at once or after the pause. */
function search(immediately = false) {
  clearTimeout(searchTimer)
  /** Applies the typed search if it changed. */
  const run = () => {
    const text = searchText.value.trim()
    if (text !== query.value.q) void go({ ...query.value, q: text, page: 1 })
  }
  if (immediately) run()
  else searchTimer = setTimeout(run, SEARCH_DELAY_MS)
}
watch(
  () => query.value.q,
  (value) => (searchText.value = value),
)
onBeforeUnmount(() => clearTimeout(searchTimer))

const isArchives = computed(() => query.value.scope === 'archived')
const newLocation = computed(() => localePath(adminEditPath(query.value.kind, 'new')))

const announceFailure = useAdminFailure()
// Archiving, restoring or deleting: a refusal from the API is shown above the list, a transient failure by a toast.
const errorKey = ref<string>()
/**
 * Reloads the list and the archive count after a write. When the write removed the only row of a
 * later page, it goes straight to the previous page instead of loading an empty one.
 */
async function refreshAfterWrite() {
  const current = page.value
  const reload =
    current?.items.length === 1 && current.page > 1
      ? go({ ...query.value, page: current.page - 1 })
      : refresh()
  await Promise.all([reload, refreshArchivesCount()])
}
/** Runs a write then refreshes the list; a failure is announced, with a retry for a transient one. */
async function write(action: () => Promise<unknown>, retry: () => void) {
  errorKey.value = undefined
  try {
    await action()
    await refreshAfterWrite()
  } catch (cause) {
    errorKey.value = announceFailure(cause, retry)
  }
}
/** Archives or restores a record. */
const setArchived = (item: AdminListItem, archived: boolean) =>
  write(
    () =>
      archived
        ? client.archive(query.value.kind, item.id)
        : client.restore(query.value.kind, item.id),
    () => void setArchived(item, archived),
  )
// Only works have a summary (members who follow them, related works).
const loadImpact = computed(() =>
  query.value.kind === 'works'
    ? async (item: AdminListItem) => archiveImpact(await client.get<AdminWork>('works', item.id))
    : undefined,
)
/** Restores a record. */
const restore = (item: AdminListItem) => setArchived(item, false)
/** Archives a record. */
const archive = (item: AdminListItem) => setArchived(item, true)

/** Deletes an archived record for good, then refreshes the list and the archive count. */
const remove = (item: AdminListItem) =>
  write(
    () => client.remove(query.value.kind, item.id),
    () => void remove(item),
  )
</script>

<template>
  <div class="catalogue">
    <AdminNav />
    <div class="catalogue__heading">
      <h1 class="catalogue__title">{{ t('admin.catalogue.title') }}</h1>
      <UiButton v-if="!isArchives" :to="newLocation" class="catalogue__new" data-testid="admin-new">
        <Icon name="tabler:plus" size="16" aria-hidden="true" />{{
          t(`admin.newKind.${query.kind}`)
        }}
      </UiButton>
    </div>
    <div
      v-if="draftTotal > 0 && query.state !== 'draft'"
      class="catalogue__drafts"
      data-testid="admin-drafts"
    >
      <p class="catalogue__drafts-text">
        <Icon name="tabler:eye-off" size="20" aria-hidden="true" />
        {{ t('admin.draftsToFinish', { count: draftTotal }) }}
      </p>
      <div class="catalogue__drafts-kinds">
        <UiButton
          v-for="draftKind in draftKinds"
          :key="draftKind.kind"
          variant="secondary"
          size="small"
          :data-testid="`admin-show-drafts-${draftKind.kind}`"
          @click="showDrafts(draftKind.kind)"
        >
          {{ t(`admin.draftCount.${draftKind.kind}`, { count: draftKind.count }) }}
        </UiButton>
      </div>
    </div>
    <UiTabs v-model="tabModel" underline :tabs="tabs" :label="t('admin.catalogue.kinds')" />
    <div class="catalogue__tools">
      <form class="catalogue__search" role="search" @submit.prevent="search(true)">
        <UiSearchField
          v-model="searchText"
          maxlength="100"
          :label="t(`admin.searchPlaceholder.${query.kind}`)"
          :placeholder="t(`admin.searchPlaceholder.${query.kind}`)"
          data-testid="admin-search"
          @input="search()"
        />
      </form>
      <UiSelect
        v-if="isArchives"
        v-model="kindModel"
        boxed
        :options="kindOptions"
        :label="t('admin.catalogue.kinds')"
      />
      <AdminFilters
        v-else
        class="catalogue__filters"
        :kind="query.kind"
        :filters="filters"
        :state="query.state"
        :sort="query.sort"
        :formats="formatCodes"
        :total="page?.total ?? 0"
        @change="changeFilters"
        @state="changeState"
        @sort="changeSort"
        @reset="resetFilters"
      />
    </div>
    <p v-if="isArchives" class="catalogue__note">{{ t('admin.archivesNote') }}</p>
    <UiFormError v-if="errorKey">{{ t(errorKey) }}</UiFormError>
    <AdminResourceRows
      v-if="page && page.items.length > 0"
      :kind="query.kind"
      :items="page.items"
      :load-impact="loadImpact"
      @restore="restore"
      @archive="archive"
      @remove="remove"
    />
    <UiStatePanel
      v-else
      :title="t('admin.empty')"
      :text="
        isArchives ? undefined : t('admin.emptyHint', { action: t(`admin.newKind.${query.kind}`) })
      "
    />
    <UiPagination v-if="page" :page="page.page" :pages="pageCount(page)" :link-for="linkFor" />
  </div>
</template>

<style scoped lang="scss">
.catalogue {
  display: grid;
  gap: var(--space-4);
}

.catalogue__heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.catalogue__title {
  margin: 0;
  color: var(--color-blue);
}

// Stays on the right, even when it drops under the title on a narrow screen.
.catalogue__new {
  margin-left: auto;
}

.catalogue__drafts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.catalogue__drafts-text {
  display: flex;
  flex: 1;
  gap: var(--space-3);
  align-items: center;
  margin: 0;
  font-size: 0.875rem;

  // On a phone the message takes its own row and the buttons go together below it.
  @media (max-width: 767px) {
    flex-basis: 100%;
  }
}

.catalogue__drafts-kinds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.catalogue__tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.catalogue__filters {
  flex: 1;
}

.catalogue__search {
  flex: 1;
  min-width: 14rem;
  max-width: 28rem;

  // Up to 1279 px the search takes the whole row and the filters go below: side by side,
  // the sort fell alone onto a third row.
  @media (max-width: 1279px) {
    flex-basis: 100%;
    max-width: none;
  }
}

.catalogue__note {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
