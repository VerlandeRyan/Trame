<script setup lang="ts">
import type { ListUnit } from '~/utils/reading-list'

// Ce que la grille compte sur les couvertures : « Compter [Chapitres | Tomes] ». Au mobile le libellé
// et les icônes s'effacent (« Ch. | Tomes » suffit) mais restent lus par les lecteurs d'écran.
const unit = defineModel<ListUnit>({ required: true })
const { t } = useI18n()

const choices: { unit: ListUnit; icon: string; label: string; shortLabel: string }[] = [
  {
    unit: 'chapters',
    icon: 'tabler:bookmark',
    label: 'list.chapters',
    shortLabel: 'list.chaptersShort',
  },
  { unit: 'volumes', icon: 'tabler:books', label: 'list.volumes', shortLabel: 'list.volumesShort' },
]
</script>

<template>
  <fieldset class="unit-toggle">
    <legend class="unit-toggle__legend">{{ t('list.unitLabel') }}</legend>
    <span class="unit-toggle__prefix" aria-hidden="true">{{ t('list.unitPrefix') }}</span>
    <div class="unit-toggle__buttons">
      <button
        v-for="choice in choices"
        :key="choice.unit"
        type="button"
        class="unit-toggle__button"
        :aria-pressed="unit === choice.unit"
        :aria-label="t(choice.label)"
        :data-testid="`list-unit-${choice.unit}`"
        @click="unit = choice.unit"
      >
        <Icon :name="choice.icon" size="16" aria-hidden="true" class="unit-toggle__icon" />
        <span class="unit-toggle__text unit-toggle__text--long">{{ t(choice.label) }}</span>
        <span class="unit-toggle__text unit-toggle__text--short" aria-hidden="true">
          {{ t(choice.shortLabel) }}
        </span>
      </button>
    </div>
  </fieldset>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Un `<fieldset>` nomme le groupe de boutons pour les lecteurs d'écran ; sa mise en forme native
// (cadre, marges) est remise à zéro et sa légende n'est lue que par eux.
.unit-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 0.8125rem;
}

.unit-toggle__legend {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

// Libellé « Compter » : au bureau seulement.
.unit-toggle__prefix {
  display: none;
  color: var(--color-ink-soft);

  @media (min-width: 768px) {
    display: inline;
  }
}

.unit-toggle__buttons {
  display: flex;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  overflow: hidden;
}

.unit-toggle__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: inherit;
  font-weight: 700;
  cursor: pointer;

  @media (pointer: coarse) {
    min-height: var(--touch);
  }

  // Survol souris : simple changement de couleur, sans animation.
  @include on-hover {
    &[aria-pressed='false'] {
      background: var(--color-cover-empty);
    }
  }

  &[aria-pressed='true'] {
    background: var(--color-ink);
    color: var(--color-surface);
  }
}

// Au mobile, « Ch. » et « Tomes » sans icône. Au bureau, les libellés entiers avec icône.
.unit-toggle__icon {
  display: none;

  @media (min-width: 768px) {
    display: inline-block;
  }
}

.unit-toggle__text--short {
  @media (min-width: 768px) {
    display: none;
  }
}

.unit-toggle__text--long {
  @media (max-width: 767px) {
    display: none;
  }
}
</style>
