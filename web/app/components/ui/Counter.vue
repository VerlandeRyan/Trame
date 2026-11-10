<script setup lang="ts">
/**
 * Counter with minus / editable value / plus (chapters read, volumes read), never added together.
 * `emptyLabel` replaces the minimum value when displayed (the rating shows a dash until rated).
 * `compact`: size used on the work page (24 px buttons, 44 px tall touch target).
 */
const props = withDefaults(
  defineProps<{
    label: string
    min?: number
    max?: number
    emptyLabel?: string
    compact?: boolean
  }>(),
  { min: 0, max: undefined, emptyLabel: undefined, compact: false },
)
const value = defineModel<number>({ default: 0 })
const { t } = useI18n()

/** Text shown for a value, using `emptyLabel` at the minimum. */
const displayFor = (amount: number) =>
  props.emptyLabel !== undefined && amount === props.min ? props.emptyLabel : String(amount)

// Many digits: the font shrinks so the whole value stays visible.
const LONG_VALUE_LENGTH = 4
const LONGER_VALUE_LENGTH = 5
const valueLengthClass = computed(() => {
  const length = displayFor(value.value).length
  if (length >= LONGER_VALUE_LENGTH) return 'counter__value--longer'
  return length === LONG_VALUE_LENGTH ? 'counter__value--long' : undefined
})

const canDecrease = computed(() => value.value > props.min)
const canIncrease = computed(() => props.max === undefined || value.value < props.max)

/** Clamps a value between the minimum and the maximum. */
function keepInBounds(candidate: number): number {
  const upperBound = props.max ?? Number.POSITIVE_INFINITY
  return Math.min(upperBound, Math.max(props.min, candidate))
}

/** Removes one, down to the minimum. */
function decrease() {
  value.value = keepInBounds(value.value - 1)
}

/** Adds one, up to the maximum. */
function increase() {
  value.value = keepInBounds(value.value + 1)
}

/** Validates typed input: keeps digits only, within bounds; empty means the minimum. */
function commitTypedValue(event: Event) {
  const field = event.target as HTMLInputElement
  const digits = field.value.replace(/\D/g, '')
  const typedValue = digits === '' ? props.min : Number.parseInt(digits, 10)
  const bounded = keepInBounds(typedValue)
  value.value = bounded
  field.value = displayFor(bounded)
}
</script>

<template>
  <div class="counter" :class="{ 'counter--compact': compact }">
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
        :class="valueLengthClass"
        type="text"
        inputmode="numeric"
        :value="displayFor(value)"
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
@use '~/assets/styles/mixins' as *;

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

  @include lift-on-hover;

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

.counter__value--long {
  font-size: 1.125rem;
}

.counter__value--longer {
  font-size: 0.9375rem;
}

// Work page size: 24 px buttons. The touch area is 44 px tall and stops at the edge of the value
// (`--counter-gap`): it never covers another one. The parent can tighten the whole with
// `--counter-gap` and `--counter-value-width`.
.counter--compact {
  --counter-size: 24px;

  .counter__label {
    font-size: 0.6875rem;
    font-weight: 400;
  }

  .counter__controls {
    gap: var(--counter-gap, 10px);
  }

  // `padding: 0`: otherwise the button keeps the browser's inset and the icon moves off centre.
  .counter__button {
    position: relative;
    width: var(--counter-size);
    height: var(--counter-size);
    padding: 0;

    // Click area: the button itself with a mouse, 44 px tall with a finger.
    &::after {
      content: '';
      position: absolute;
      inset: 0;

      @media (pointer: coarse) {
        inset: calc((var(--counter-size) - var(--touch)) / 2) calc(-1 * var(--counter-gap, 10px));
      }
    }
  }

  .counter__value {
    width: var(--counter-value-width, 2.25rem);
    min-height: 28px;
    padding: 0;
    font-size: 1.125rem;
  }

  .counter__value--long {
    font-size: 0.8125rem;
  }

  .counter__value--longer {
    font-size: 0.6875rem;
  }
}
</style>
