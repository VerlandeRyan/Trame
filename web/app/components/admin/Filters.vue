<script setup lang="ts">
import {
  ADMIN_WORK_SORTS,
  optionsOf,
  WORK_STATUSES,
  WORK_TYPES,
  type AdminWorkFilters,
  type AdminWorkSort,
} from '~/utils/admin'

/**
 * Filters and sort of the work list: type, format and status, multiple choice; an empty list
 * means "all". Changes are emitted at once. On mobile, the three filters fit in a sheet opened
 * by "Filters", like the search page.
 */
const props = defineProps<{
  filters: AdminWorkFilters
  sort: AdminWorkSort
  /** Known format codes (manga, webtoon…). */
  formats: string[]
  /** Number of records found, shown by the sheet button. */
  total: number
}>()
const emit = defineEmits<{ change: [filters: AdminWorkFilters]; sort: [sort: AdminWorkSort] }>()
const { t } = useI18n()
const genreLabel = useGenreLabel()

const typeOptions = computed(() =>
  optionsOf(WORK_TYPES, (code) => t(`admin.option.workType.${code}`)),
)
const statusOptions = computed(() =>
  optionsOf(WORK_STATUSES, (code) => t(`admin.option.workStatus.${code}`)),
)
const formatOptions = computed(() => optionsOf(props.formats, genreLabel))
const sortOptions = computed(() => optionsOf(ADMIN_WORK_SORTS, (code) => t(`admin.sort.${code}`)))

/** Replaces the values of one filter. */
const setFilter = (name: keyof AdminWorkFilters, values: string[]) =>
  emit('change', { ...props.filters, [name]: values })

/** Total number of selected filter values. */
const activeCount = computed(() =>
  Object.values(props.filters).reduce((total, values) => total + values.length, 0),
)
/** Clears every filter. */
const reset = () => emit('change', { type: [], status: [], format: [] })

/** Adds the value to a filter, or removes it if already selected. */
function toggleFilter(name: keyof AdminWorkFilters, value: string) {
  const chosen = props.filters[name]
  setFilter(
    name,
    chosen.includes(value) ? chosen.filter((item) => item !== value) : [...chosen, value],
  )
}

const isSheetOpen = ref(false)
const openGroups = reactive({ type: true, format: true, status: true })
const areAllGroupsOpen = computed(() => Object.values(openGroups).every(Boolean))
/** Opens or collapses every group of the sheet. */
function setAllGroups(isOpen: boolean) {
  openGroups.type = openGroups.format = openGroups.status = isOpen
}
const sheetGroups = computed(
  () =>
    [
      { name: 'type', label: t('admin.filter.type'), options: typeOptions.value },
      { name: 'format', label: t('admin.filter.format'), options: formatOptions.value },
      { name: 'status', label: t('admin.filter.status'), options: statusOptions.value },
    ] as const,
)
</script>

<template>
  <div class="filters" data-testid="admin-filters">
    <UiButton
      variant="secondary"
      size="small"
      class="filters__open"
      data-testid="filters-open"
      @click="isSheetOpen = true"
    >
      {{
        activeCount > 0
          ? t('admin.filter.withCount', { count: activeCount })
          : t('admin.filter.title')
      }}
      <Icon name="tabler:adjustments-horizontal" size="16" aria-hidden="true" />
    </UiButton>
    <div class="filters__inline">
      <UiMultiSelect
        :model-value="filters.type"
        :options="typeOptions"
        :label="t('admin.filter.type')"
        :empty-label="t('admin.filter.all')"
        :clear-label="t('admin.filter.clear')"
        trigger-test-id="filter-type"
        @update:model-value="setFilter('type', $event)"
      />
      <UiMultiSelect
        :model-value="filters.format"
        :options="formatOptions"
        :label="t('admin.filter.format')"
        :empty-label="t('admin.filter.all')"
        :clear-label="t('admin.filter.clear')"
        trigger-test-id="filter-format"
        @update:model-value="setFilter('format', $event)"
      />
      <UiMultiSelect
        :model-value="filters.status"
        :options="statusOptions"
        :label="t('admin.filter.status')"
        :empty-label="t('admin.filter.all')"
        :clear-label="t('admin.filter.clear')"
        trigger-test-id="filter-status"
        @update:model-value="setFilter('status', $event)"
      />
      <UiButton
        v-if="activeCount > 0"
        variant="secondary"
        size="small"
        data-testid="filter-reset"
        @click="reset"
      >
        <Icon name="tabler:x" size="16" aria-hidden="true" />{{ t('admin.filter.reset') }}
      </UiButton>
    </div>
    <UiSelect
      class="filters__sort"
      boxed
      :model-value="sort"
      :options="sortOptions"
      :label="t('admin.sort.label')"
      trigger-test-id="filter-sort"
      @update:model-value="emit('sort', $event as AdminWorkSort)"
    />
    <UiModal
      v-model="isSheetOpen"
      placement="bottom"
      :title="t('admin.filter.title')"
      :close-label="t('action.close')"
    >
      <template #actions>
        <button
          type="button"
          class="filters__collapse link-underlined"
          data-testid="filters-sheet-collapse"
          @click="setAllGroups(!areAllGroupsOpen)"
        >
          {{ areAllGroupsOpen ? t('search.collapseAll') : t('search.expandAll') }}
        </button>
      </template>
      <div class="filters__sheet">
        <AdminFilterGroup
          v-for="group in sheetGroups"
          :key="group.name"
          v-model:open="openGroups[group.name]"
          :name="group.name"
          :label="group.label"
          :options="group.options"
          :selected="filters[group.name]"
          @toggle="toggleFilter(group.name, $event)"
        />
      </div>
      <template #footer>
        <UiButton
          variant="secondary"
          class="filters__sheet-reset"
          data-testid="filters-sheet-reset"
          @click="reset"
        >
          {{ t('admin.filter.reset') }}
        </UiButton>
        <UiButton
          variant="primary"
          class="filters__sheet-apply"
          data-testid="filters-sheet-apply"
          @click="isSheetOpen = false"
        >
          {{ t('search.viewResults', { count: total }, total) }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

// Desktop first: the mobile version must never show, even before all styles are loaded.
// `.filters` is added to win over `UiButton`'s `display`, whatever the order.
.filters .filters__open {
  display: none;
}

.filters__inline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.filters__sort {
  margin-left: auto;
}

.filters__sheet {
  display: grid;
  gap: 4px;
}

.filters__collapse {
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

// Sheet footer: "Reset" takes 1/3, "See N results" 2/3, over the full width.
.filters__sheet-reset {
  flex: 1;
}

.filters__sheet-apply {
  flex: 2;
}

@media (max-width: 1023px) {
  .filters__inline {
    display: none;
  }

  .filters .filters__open {
    display: inline-flex;
  }
}
</style>
