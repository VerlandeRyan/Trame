<script setup lang="ts">
import type { ListView } from '~/utils/reading-list'

// Bascule Liste / Grille ; au mobile l'icône seule suffit (le libellé reste lu par les lecteurs d'écran).
defineProps<{ view: ListView }>()
const emit = defineEmits<{ change: [view: ListView] }>()
const { t } = useI18n()
</script>

<template>
  <fieldset class="view-toggle">
    <legend class="view-toggle__legend">{{ t('list.viewLabel') }}</legend>
    <button
      type="button"
      class="view-toggle__button"
      :aria-pressed="view === 'list'"
      data-testid="list-view-list"
      @click="emit('change', 'list')"
    >
      <Icon name="tabler:list" size="16" aria-hidden="true" />
      <span class="view-toggle__label">{{ t('list.viewList') }}</span>
    </button>
    <button
      type="button"
      class="view-toggle__button"
      :aria-pressed="view === 'grid'"
      data-testid="list-view-grid"
      @click="emit('change', 'grid')"
    >
      <Icon name="tabler:layout-grid" size="16" aria-hidden="true" />
      <span class="view-toggle__label">{{ t('list.viewGrid') }}</span>
    </button>
  </fieldset>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Un `<fieldset>` nomme le groupe de boutons pour les lecteurs d'écran ; ses marges natives sont
// remises à zéro et sa légende n'est lue que par eux.
.view-toggle {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  overflow: hidden;
}

.view-toggle__legend {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.view-toggle__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: 0.8125rem;
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

.view-toggle__label {
  @media (max-width: 767px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
