<script setup lang="ts">
// Groupe repliable de cases à cocher de la feuille de filtres mobile (même forme que `search/FilterGroup`,
// sans compteurs). L'état ouvert/fermé appartient au parent (`v-model:open`), pour « Tout replier ».
const props = defineProps<{
  /** Nom du groupe, repris dans les `data-testid` des cases. */
  name: string
  label: string
  options: { value: string; label: string }[]
  selected: string[]
}>()
const emit = defineEmits<{ toggle: [value: string] }>()
const isOpen = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const panelId = `${useId()}-panel`
const selectedCount = computed(() => props.selected.length)
</script>

<template>
  <section class="filter-group">
    <h3 class="filter-group__heading">
      <button
        type="button"
        class="filter-group__title"
        :aria-expanded="isOpen"
        :aria-controls="panelId"
        @click="isOpen = !isOpen"
      >
        <Icon
          name="tabler:chevron-down"
          size="14"
          aria-hidden="true"
          :class="{ 'filter-group__chevron--closed': !isOpen }"
        />
        <span>{{ label }}</span>
        <span
          v-if="selectedCount > 0"
          class="filter-group__badge"
          :aria-label="t('search.selectedCount', selectedCount)"
        >
          {{ selectedCount }}
        </span>
      </button>
    </h3>
    <ul v-show="isOpen" :id="panelId" class="filter-group__list">
      <li v-for="option in options" :key="option.value">
        <label class="filter-group__option">
          <input
            type="checkbox"
            class="filter-group__checkbox"
            :checked="selected.includes(option.value)"
            :data-testid="`sheet-${name}-${option.value}`"
            @change="emit('toggle', option.value)"
          />
          {{ option.label }}
        </label>
      </li>
    </ul>
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
  gap: 6px;
  align-items: center;
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

.filter-group__list {
  margin: 0;
  padding: 0 0 4px;
}

.filter-group__option {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  font-size: 0.9375rem;
  cursor: pointer;
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
</style>
