<script setup lang="ts">
// Compteur − / valeur saisissable / + (chapitres lus, tomes lus). Jamais additionnés entre eux.
// `emptyLabel` remplace la valeur minimale à l'affichage (la note : « — » tant qu'on n'a pas noté).
// `compact` : taille des maquettes de la fiche œuvre (boutons de 24 px, zone tactile de 44 px de haut).
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

const displayFor = (amount: number) =>
  props.emptyLabel !== undefined && amount === props.min ? props.emptyLabel : String(amount)

// Beaucoup de chiffres : la police rétrécit pour que toute la valeur reste visible.
const LONG_VALUE_LENGTH = 4
const LONGER_VALUE_LENGTH = 5
const valueLengthClass = computed(() => {
  const length = displayFor(value.value).length
  if (length >= LONGER_VALUE_LENGTH) return 'counter__value--longer'
  return length === LONG_VALUE_LENGTH ? 'counter__value--long' : undefined
})

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

// Maquettes de la fiche œuvre : boutons de 24 px. La zone tactile fait 44 px de haut et s'arrête
// au bord de la valeur (`--counter-gap`) : elle n'en recouvre jamais une autre. Le parent peut
// resserrer l'ensemble avec `--counter-gap` et `--counter-value-width`.
.counter--compact {
  --counter-size: 24px;

  .counter__label {
    font-size: 0.6875rem;
    font-weight: 400;
  }

  .counter__controls {
    gap: var(--counter-gap, 10px);
  }

  // `padding: 0` : sans lui le bouton garde le retrait du navigateur et l'icône sort du centre.
  .counter__button {
    position: relative;
    width: var(--counter-size);
    height: var(--counter-size);
    padding: 0;

    // Zone de clic : le bouton à la souris, 44 px de haut au doigt.
    &::after {
      content: '';
      position: absolute;
      inset: 0;

      @media (pointer: coarse) {
        inset: calc((var(--counter-size) - var(--touch)) / 2) calc(-1 * var(--counter-gap, 10px));
      }
    }

    // Même mouvement que les flèches du carrousel de l'accueil.
    @media (prefers-reduced-motion: no-preference) {
      transition:
        transform 0.12s ease-out,
        box-shadow 0.12s ease-out,
        background-color 0.15s;
    }

    @include on-hover {
      background: var(--color-rose);

      @media (prefers-reduced-motion: no-preference) {
        box-shadow: var(--shadow-small);
        transform: translate(-1px, -1px);
      }
    }

    // Au doigt, l'appui remplace le survol.
    &:active:not(:disabled) {
      background: var(--color-rose);
      box-shadow: none;
      transform: translate(1px, 1px);
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
