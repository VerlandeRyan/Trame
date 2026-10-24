<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// Catalogue d'administration (US-11, maquette 22) : l'adresse porte l'onglet, la recherche, les
// filtres, le tri et la page. Chaque onglet a sa propre recherche.
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
// La fiche ouverte depuis cette liste y ramène, avec le même onglet, la même recherche et les mêmes filtres.
watch(query, (value) => (lastList.value = value), { immediate: true })

const { data: page, refresh } = await useAsyncData(
  () => `admin-${JSON.stringify(query.value)}`,
  () => client.list(query.value),
  { watch: [query] },
)
// Nombre d'archives du type en cours, affiché sur l'onglet « Archives ».
const { data: archivesCount, refresh: refreshArchivesCount } = await useAsyncData(
  () => `admin-archives-${query.value.kind}`,
  async () => {
    const archives = {
      ...parseAdminListQuery({ kind: query.value.kind }),
      scope: 'archived' as const,
    }
    return (await client.list(archives, 1)).total
  },
  { watch: [() => query.value.kind] },
)
// Formats proposés au filtre des œuvres.
const { data: genres } = await useAsyncData('admin-formats', () =>
  api.request<{ items: { code: string; category: string }[] }>('/genres'),
)
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

function go(next: AdminListQuery) {
  return router.push({ query: toAdminRouteQuery(next) })
}
const filters = computed<AdminWorkFilters>(() => ({
  type: query.value.type,
  status: query.value.status,
  format: query.value.format,
}))
const changeFilters = (filters: AdminWorkFilters) => go({ ...query.value, ...filters, page: 1 })
const changeSort = (sort: AdminWorkSort) => go({ ...query.value, sort, page: 1 })
const linkFor = (target: number): RouteLocationRaw => ({
  query: toAdminRouteQuery({ ...query.value, page: target }),
})

// Recherche : s'applique à la frappe, après une courte pause, ou à « Entrée ».
const SEARCH_DELAY_MS = 300
const searchText = ref(parseAdminListQuery(route.query).q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
function search(immediately = false) {
  clearTimeout(searchTimer)
  const run = () => {
    const text = searchText.value.trim()
    if (text !== query.value.q) go({ ...query.value, q: text, page: 1 })
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

// Archivage ou restauration : un refus de l'API est annoncé.
const errorKey = ref<string>()
async function setArchived(item: AdminListItem, archived: boolean) {
  errorKey.value = undefined
  try {
    await (archived
      ? client.archive(query.value.kind, item.id)
      : client.restore(query.value.kind, item.id))
    await Promise.all([refresh(), refreshArchivesCount()])
  } catch (cause) {
    errorKey.value = adminErrorKey(cause, api.messageKeyFor)
  }
}
const restore = (item: AdminListItem) => setArchived(item, false)
const archive = (item: AdminListItem) => setArchived(item, true)
</script>

<template>
  <div class="catalogue">
    <AdminNav />
    <div class="catalogue__heading">
      <h1 class="catalogue__title">{{ t('admin.catalogue.title') }}</h1>
      <UiButton v-if="!isArchives" :to="newLocation" data-testid="admin-new">
        <Icon name="tabler:plus" size="16" aria-hidden="true" />{{
          t(`admin.newKind.${query.kind}`)
        }}
      </UiButton>
    </div>
    <UiTabs v-model="tabModel" underline :tabs="tabs" :label="t('admin.catalogue.kinds')" />
    <div class="catalogue__tools">
      <form class="catalogue__search" role="search" @submit.prevent="search(true)">
        <Icon name="tabler:search" size="18" aria-hidden="true" />
        <input
          v-model="searchText"
          type="search"
          class="catalogue__search-input"
          maxlength="100"
          :aria-label="t(`admin.searchPlaceholder.${query.kind}`)"
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
        v-else-if="query.kind === 'works'"
        class="catalogue__filters"
        :filters="filters"
        :sort="query.sort"
        :formats="formatCodes"
        :total="page?.total ?? 0"
        @change="changeFilters"
        @sort="changeSort"
      />
    </div>
    <p v-if="errorKey" class="catalogue__error" role="alert">{{ t(errorKey) }}</p>
    <AdminResourceRows
      v-if="page && page.items.length > 0"
      :kind="query.kind"
      :items="page.items"
      @restore="restore"
      @archive="archive"
    />
    <UiEmptyState v-else :title="t('admin.empty')" />
    <p v-if="isArchives" class="catalogue__note">{{ t('admin.archivesNote') }}</p>
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
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: center;
  min-width: 14rem;
  max-width: 28rem;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  // Au mobile la recherche prend toute la ligne, les filtres passent dessous.
  @media (max-width: 767px) {
    flex-basis: 100%;
    max-width: none;
  }

  &:focus-within {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }
}

.catalogue__search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  // 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
  font-size: 1rem;

  &:focus {
    outline: none;
  }
}

.catalogue__note {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.catalogue__error {
  margin: 0;
  color: var(--color-crimson);
  font-weight: 700;
}
</style>
