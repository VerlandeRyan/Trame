<script setup lang="ts">
// Compteur − / valeur saisissable / + (chapitres lus, tomes lus). Jamais additionnés entre eux.
const props = withDefaults(defineProps<{ label: string; min?: number; max?: number }>(), {
  min: 0,
  max: undefined,
})
const value = defineModel<number>({ default: 0 })
const { t } = useI18n()

const canDecrease = computed(() => value.value > props.min)
const canIncrease = computed(() => props.max === undefined || value.value < props.max)

function keepInBounds(candidate: number): number {
  const upperBound = props.max ?? Number.POSITIVE_INFINITY
  return Math.min(upperBound, Math.max(props.min, candidate))
}

function decrease() {
  value.value = keepInBounds(value.value - 1)
}

function increase() {
  value.value = keepInBounds(value.value + 1)
}

// Validation de la saisie : on ne garde que les chiffres, bornés ; vide = minimum.
function commitTypedValue(event: Event) {
  const field = event.target as HTMLInputElement
  const digits = field.value.replace(/\D/g, '')
  const typedValue = digits === '' ? props.min : Number.parseInt(digits, 10)
  value.value = keepInBounds(typedValue)
  field.value = String(value.value)
}
</script>

<template>
  <div class="counter">
    <span class="counter__label">{{ label }}</span>
    <div class="counter__controls">
      <button
        type="button"
        class="counter__button"
        :disabled="!canDecrease"
        :aria-label="t('counter.decrease', { label })"
        @click="decrease"
      >
        <Icon name="tabler:minus" aria-hidden="true" />
      </button>
      <input
        class="counter__value"
        type="text"
        inputmode="numeric"
        :value="value"
        :aria-label="label"
        @change="commitTypedValue"
      />
      <button
        type="button"
        class="counter__button"
        :disabled="!canIncrease"
        :aria-label="t('counter.increase', { label })"
        @click="increase"
      >
        <Icon name="tabler:plus" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.counter {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
}

.counter__label {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.counter__controls {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.counter__button {
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.counter__value {
  width: 3.5rem;
  min-height: var(--touch);
  border: 0;
  border-radius: var(--radius);
  background: var(--color-field-soft);
  font-size: 1.375rem;
  font-weight: 800;
  text-align: center;
}
</style>
