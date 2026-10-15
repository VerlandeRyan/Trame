<script setup lang="ts">
import { filterOptions, filterValueLabel, type FacetCount, type FilterKey } from '~/utils/search'
import { foldAccents } from '~/utils/work'

// L'état ouvert/fermé appartient au parent (`v-model:open`), pour « Tout replier ».
const props = withDefaults(
  defineProps<{
    filterKey: FilterKey
    facets: FacetCount[]
    selected?: string[]
    open: boolean
    /** Champ pour filtrer la liste des valeurs. */
    searchable?: boolean
    /** Valeurs visibles avant « Voir les N autres ». */
    limit?: number
  }>(),
  { selected: () => [], searchable: false, limit: 5 },
)
const emit = defineEmits<{ toggle: [code: string]; 'update:open': [open: boolean] }>()
const { t, te } = useI18n()
const uid = useId()
const panelId = `${uid}-panel`

const needle = ref('')
const expanded = ref(false)

const options = computed(() => {
  const all = filterOptions(props.facets, props.selected).map((facet) => ({
    ...facet,
    label: filterValueLabel(t, te, props.filterKey, facet.code),
  }))
  const search = foldAccents(needle.value.trim())
  return search === '' ? all : all.filter((option) => foldAccents(option.label).includes(search))
})

const visible = computed(() => {
  if (expanded.value || needle.value.trim() !== '') return options.value
  const head = options.value.slice(0, props.limit)
  // Les valeurs choisies restent visibles au-delà de la limite.
  const chosen = options.value.filter(
    (option) => props.selected.includes(option.code) && !head.includes(option),
  )
  return [...head, ...chosen]
})
const hiddenCount = computed(() => options.value.length - visible.value.length)
const selectedCount = computed(() => props.selected.length)
</script>

<template>
  <section v-if="facets.length > 0 || selected.length > 0" class="filter-group" :data-open="open">
    <h3 class="filter-group__heading">
      <button
        type="button"
        class="filter-group__title"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="emit('update:open', !open)"
      >
        <Icon
          name="tabler:chevron-down"
          size="14"
          aria-hidden="true"
          class="filter-group__chevron"
          :class="{ 'filter-group__chevron--closed': !open }"
        />
        <span class="filter-group__name">{{ t(`search.group.${filterKey}`) }}</span>
        <span
          v-if="selectedCount > 0"
          class="filter-group__badge"
          :aria-label="t('search.selectedCount', selectedCount)"
          data-testid="filter-badge"
        >
          {{ selectedCount }}
        </span>
      </button>
    </h3>

    <div v-show="open" :id="panelId" class="filter-group__panel">
      <div v-if="searchable" class="filter-group__search">
        <label :for="`${uid}-search`" class="filter-group__sr">{{
          t('search.filterGenres')
        }}</label>
        <Icon name="tabler:search" size="11" aria-hidden="true" class="filter-group__search-icon" />
        <input
          :id="`${uid}-search`"
          v-model="needle"
          type="search"
          class="filter-group__input"
          :placeholder="t('search.filterGenres')"
        />
      </div>

      <ul class="filter-group__list">
        <li v-for="option in visible" :key="option.code">
          <label class="filter-group__option">
            <input
              type="checkbox"
              class="filter-group__checkbox"
              :checked="selected.includes(option.code)"
              :data-testid="`filter-${filterKey}-${option.code}`"
              @change="emit('toggle', option.code)"
            />
            <span class="filter-group__label">{{ option.label }}</span>
            <span class="filter-group__count">{{ option.count }}</span>
          </label>
        </li>
      </ul>

      <button
        v-if="hiddenCount > 0 || expanded"
        type="button"
        class="filter-group__more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? t('search.showFewer') : t('search.showOthers', { count: hiddenCount }) }}
        <Icon
          :name="expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'"
          size="11"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.filter-group {
  border-bottom: var(--border);
}

.filter-group__heading {
  margin: 0;
  font-size: inherit;
}

.filter-group__title {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 0;
    padding: 6px 0 8px;
    font-size: 0.9375rem;
  }
}

.filter-group__chevron--closed {
  transform: rotate(-90deg);
}

.filter-group__badge {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-blue);
  color: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.5;
}

.filter-group__panel {
  padding: 0 0 4px;

  @media (min-width: 768px) {
    padding: 6px 0 10px;
  }
}

.filter-group__list {
  margin: 0;
  padding: 0;
}

.filter-group__option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 0;
    padding: 5px 0;
  }
}

// Case dessinée : le rendu natif varie selon les navigateurs.
.filter-group__checkbox {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 3px solid var(--color-ink);
  border-radius: 4px;
  background: var(--color-surface);
  appearance: none;
  cursor: pointer;

  &:checked {
    background-color: var(--color-blue);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.5 5.2 4 7.6 8.5 2.4' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E");
    background-position: center;
    background-size: 100%;
  }
}

.filter-group__label {
  flex: 1;
  font-size: 0.9375rem;

  @media (min-width: 768px) {
    font-size: 0.875rem;
  }
}

.filter-group__count {
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.filter-group__search {
  position: relative;
  margin: 2px 0 6px;
}

.filter-group__search-icon {
  position: absolute;
  top: 50%;
  left: 8px;
  color: var(--color-ink-soft);
  transform: translateY(-50%);
  pointer-events: none;
}

.filter-group__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.filter-group__input {
  width: 100%;
  min-height: var(--touch);
  padding: 0 8px 0 24px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  // 16 px : en dessous, Safari iOS zoome au focus.
  font-size: 1rem;

  @media (min-width: 768px) {
    min-height: 0;
    padding: 4px 7px 4px 24px;
    font-size: 0.8125rem;
  }
}

.filter-group__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--touch);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 800;
  text-decoration: underline;
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 0;
    padding: 2px 0 4px;
    font-size: 0.8125rem;
  }
}
</style>
