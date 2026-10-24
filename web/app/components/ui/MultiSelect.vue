<script setup lang="ts">
// Filtre à choix multiples : bouton à cadre qui ouvre un panneau de cases à cocher. Le cadre le
// distingue du tri (`UiSelect`, texte plat) ; aucune sélection veut dire « tous ».
const props = defineProps<{
  options: { value: string; label: string }[]
  /** Nom du filtre (« Type »). */
  label: string
  /** Texte du bouton quand rien n'est coché (« Tous »). */
  emptyLabel: string
  clearLabel: string
  triggerTestId?: string
}>()
const model = defineModel<string[]>({ required: true })

const uid = useId()
const panelId = `${uid}-panel`
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.focus())

const firstLabel = computed(
  () => props.options.find((option) => option.value === model.value[0])?.label ?? '',
)
const summary = computed(() => (model.value.length === 0 ? props.emptyLabel : firstLabel.value))
const extraCount = computed(() => Math.max(0, model.value.length - 1))

const toggleOption = (value: string) =>
  (model.value = model.value.includes(value)
    ? model.value.filter((code) => code !== value)
    : [...model.value, value])
const clear = () => {
  model.value = []
  close({ restoreFocus: true })
}
</script>

<template>
  <div ref="root" class="multi-select">
    <button
      ref="trigger"
      type="button"
      class="multi-select__trigger"
      :class="{ 'multi-select__trigger--active': model.length > 0 }"
      :aria-expanded="isOpen"
      :aria-controls="panelId"
      :data-testid="triggerTestId"
      @click="isOpen = !isOpen"
    >
      <span class="multi-select__label">{{ label }}</span>
      <span class="multi-select__value">{{ summary }}</span>
      <span v-if="extraCount > 0" class="multi-select__count" data-testid="multi-select-count">
        +{{ extraCount }}
      </span>
      <Icon name="tabler:chevron-down" size="14" aria-hidden="true" class="multi-select__caret" />
    </button>

    <fieldset v-show="isOpen" :id="panelId" class="multi-select__panel" :aria-label="label">
      <label v-for="option in options" :key="option.value" class="multi-select__option">
        <input
          type="checkbox"
          class="multi-select__checkbox"
          :checked="model.includes(option.value)"
          :data-testid="`${triggerTestId ?? 'multi-select'}-${option.value}`"
          @change="toggleOption(option.value)"
        />
        {{ option.label }}
      </label>
      <button
        type="button"
        class="multi-select__clear"
        :disabled="model.length === 0"
        @click="clear"
      >
        {{ clearLabel }}
      </button>
    </fieldset>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.multi-select {
  position: relative;
  display: inline-flex;
  font-size: 0.875rem;
}

.multi-select__trigger {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;

  @include on-hover {
    background: var(--field-hover-bg, var(--color-field-soft));
  }
}

.multi-select__trigger--active {
  background: var(--color-field-soft);
}

.multi-select__label {
  color: var(--color-ink-soft);
}

.multi-select__value {
  font-weight: 700;
}

.multi-select__count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-blue);
  color: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.5;
}

.multi-select__trigger[aria-expanded='true'] .multi-select__caret {
  transform: rotate(180deg);
}

.multi-select__panel {
  position: absolute;
  inset: calc(100% + var(--space-1)) auto auto 0;
  z-index: 20;
  min-width: 100%;
  margin: 0;
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.multi-select__option {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  white-space: nowrap;
  cursor: pointer;

  @include on-hover {
    background: var(--color-field-soft);
  }

  & + & {
    border-top: 1px dashed var(--color-rule);
  }
}

// Case dessinée : le rendu natif varie selon les navigateurs.
.multi-select__checkbox {
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

  &:focus-visible {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }
}

.multi-select__clear {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  border-top: var(--border);
  background: none;
  color: var(--color-ink);
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;

  &:disabled {
    color: var(--color-ink-soft);
    cursor: default;
  }
}
</style>
