<script setup lang="ts">
import { FILTER_KEYS, type FilterKey, type SearchFilters, type WorkFacets } from '~/utils/search'

// `sheet` : dans la feuille mobile, titre et pied appartiennent à la feuille.
const props = withDefaults(
  defineProps<{ facets: WorkFacets; filters: SearchFilters; sheet?: boolean }>(),
  { sheet: false },
)
const emit = defineEmits<{ toggle: [key: FilterKey, code: string]; reset: [] }>()
const { t } = useI18n()

const OPEN_BY_DEFAULT: FilterKey[] = ['type', 'format', 'genre']

const openGroups = reactive<Record<FilterKey, boolean>>(
  Object.fromEntries(
    FILTER_KEYS.map((key) => [
      key,
      props.sheet || OPEN_BY_DEFAULT.includes(key) || props.filters[key] !== undefined,
    ]),
  ) as Record<FilterKey, boolean>,
)

// Une valeur choisie ailleurs (pastille, lien) déplie son groupe.
watch(
  () => props.filters,
  (filters) => {
    for (const key of FILTER_KEYS) if (filters[key] !== undefined) openGroups[key] = true
  },
)

const allOpen = computed(() => FILTER_KEYS.every((key) => openGroups[key]))

function setAll(open: boolean) {
  for (const key of FILTER_KEYS) openGroups[key] = open
}

// La page pilote « Tout replier » depuis l'en-tête de la feuille.
defineExpose({ allOpen, setAll })
</script>

<template>
  <div class="filters">
    <div v-if="!sheet" class="filters__head">
      <h2 class="filters__title">{{ t('search.filters') }}</h2>
      <button type="button" class="filters__collapse" @click="setAll(!allOpen)">
        {{ allOpen ? t('search.collapseAll') : t('search.expandAll') }}
      </button>
    </div>
    <SearchFilterGroup
      v-for="key in FILTER_KEYS"
      :key="key"
      v-model:open="openGroups[key]"
      :filter-key="key"
      :facets="facets[key]"
      :selected="filters[key]"
      :searchable="key === 'genre'"
      @toggle="(code) => emit('toggle', key, code)"
    />
    <button v-if="!sheet" type="button" class="filters__reset" @click="emit('reset')">
      {{ t('search.reset') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.filters {
  display: grid;
  gap: 4px;

  @media (min-width: 768px) {
    gap: 14px;
  }
}

.filters__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.filters__title {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.filters__collapse,
.filters__reset {
  min-height: var(--touch);
  padding: 0;
  border: 0;
  background: none;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 0;
  }
}

.filters__collapse {
  margin-left: auto;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.filters__reset {
  justify-self: start;
  margin-top: 2px;
  color: var(--color-ink);
  font-size: 0.875rem;
}
</style>
