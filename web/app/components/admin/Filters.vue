<script setup lang="ts">
import {
  ADMIN_STATES,
  ADMIN_WORK_SORTS,
  optionsOf,
  WORK_STATUSES,
  WORK_TYPES,
  type AdminKind,
  type AdminState,
  type AdminWorkFilters,
  type AdminWorkSort,
} from '~/utils/admin'

/**
 * Filters of an administration list. Every kind has the publication state (drafts or published);
 * works also have type, format and status (multiple choice, an empty list means "all") and a sort.
 * Changes are emitted at once. On mobile, the filters fit in a sheet opened by "Filters", like the
 * search page.
 */
const props = defineProps<{
  kind: AdminKind
  filters: AdminWorkFilters
  state: AdminState
  sort: AdminWorkSort
  /** Known format codes (manga, webtoon…). */
  formats: string[]
  /** Number of records found, shown by the sheet button. */
  total: number
}>()
const emit = defineEmits<{
  change: [filters: AdminWorkFilters]
  state: [state: AdminState]
  sort: [sort: AdminWorkSort]
  /** Clears the state and every filter at once. */
  reset: []
}>()
const isWorks = computed(() => props.kind === 'works')
const stateOptions = computed(() => optionsOf(ADMIN_STATES, (code) => t(`admin.state.${code}`)))
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

/** Total number of selected filter values, the state included. */
const activeCount = computed(
  () =>
    Object.values(props.filters).reduce((total, values) => total + values.length, 0) +
    (props.state === 'all' ? 0 : 1),
)
/** Clears the state and every filter. */
const reset = () => emit('reset')
/** Chooses a state in the sheet; choosing the current one again goes back to "all". */
const toggleState = (value: string) =>
  emit('state', props.state === value ? 'all' : (value as AdminState))

/** Adds the value to a filter, or removes it if already selected. */
function toggleFilter(name: keyof AdminWorkFilters, value: string) {
  const chosen = props.filters[name]
  setFilter(
    name,
    chosen.includes(value) ? chosen.filter((item) => item !== value) : [...chosen, value],
  )
}

const isSheetOpen = ref(false)
const openGroups = reactive({ state: true, type: true, format: true, status: true })
const areAllGroupsOpen = computed(() => Object.values(openGroups).every(Boolean))
/** Opens or collapses every group of the sheet. */
function setAllGroups(isOpen: boolean) {
  openGroups.state = openGroups.type = openGroups.format = openGroups.status = isOpen
}
const sheetGroups = computed(() => [
  {
    name: 'state' as const,
    label: t('admin.state.label'),
    options: stateOptions.value.filter((option) => option.value !== 'all'),
    selected: props.state === 'all' ? [] : [props.state],
    toggle: toggleState,
  },
  ...(isWorks.value
    ? [
        { name: 'type' as const, label: t('admin.filter.type'), options: typeOptions.value },
        { name: 'format' as const, label: t('admin.filter.format'), options: formatOptions.value },
        { name: 'status' as const, label: t('admin.filter.status'), options: statusOptions.value },
      ].map((group) => ({
        ...group,
        selected: props.filters[group.name],
        toggle: (value: string) => toggleFilter(group.name, value),
      }))
    : []),
])
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
      <UiSelect
        boxed
        :model-value="state"
        :options="stateOptions"
        :label="t('admin.state.label')"
        trigger-test-id="admin-state-filter"
        @update:model-value="emit('state', $event as AdminState)"
      />
      <UiMultiSelect
        v-if="isWorks"
        :model-value="filters.type"
        :options="typeOptions"
        :label="t('admin.filter.type')"
        :empty-label="t('admin.filter.all')"
        :clear-label="t('admin.filter.clear')"
        trigger-test-id="filter-type"
        @update:model-value="setFilter('type', $event)"
      />
      <UiMultiSelect
        v-if="isWorks"
        :model-value="filters.format"
        :options="formatOptions"
        :label="t('admin.filter.format')"
        :empty-label="t('admin.filter.all')"
        :clear-label="t('admin.filter.clear')"
        trigger-test-id="filter-format"
        @update:model-value="setFilter('format', $event)"
      />
      <UiMultiSelect
        v-if="isWorks"
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
      v-if="isWorks"
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
          :selected="group.selected"
          @toggle="group.toggle"
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
