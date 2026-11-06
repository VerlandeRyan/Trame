<script setup lang="ts" generic="T extends string">
export interface UiSegment<V extends string = string> {
  value: V
  /** Nom entier : lu par les lecteurs d'écran et affiché au bureau. */
  label: string
  icon: string
  /** Remplace l'icône et le libellé au mobile ; sans lui, l'icône seule suffit. */
  shortLabel?: string
  testId?: string
}

// Choix unique en boutons accolés, sur de vrais boutons radio : le clavier (Tab, flèches) est celui
// du navigateur. `prefix` (ex. « Compter ») ne s'affiche qu'au bureau.
defineProps<{ label: string; options: UiSegment<T>[]; prefix?: string }>()
const model = defineModel<T>({ required: true })
const name = useId()
</script>

<template>
  <div class="segmented">
    <span v-if="prefix" class="segmented__prefix" aria-hidden="true">{{ prefix }}</span>
    <fieldset class="segmented__group">
      <legend class="segmented__legend">{{ label }}</legend>
      <label v-for="option in options" :key="option.value" class="segmented__option">
        <input
          type="radio"
          class="segmented__input"
          :name="name"
          :value="option.value"
          :checked="model === option.value"
          :aria-label="option.label"
          :data-testid="option.testId"
          @change="model = option.value"
        />
        <Icon
          :name="option.icon"
          size="16"
          aria-hidden="true"
          class="segmented__icon"
          :class="{ 'segmented__icon--desktop-only': option.shortLabel }"
        />
        <span class="segmented__text segmented__text--long" aria-hidden="true">
          {{ option.label }}
        </span>
        <span
          v-if="option.shortLabel"
          class="segmented__text segmented__text--short"
          aria-hidden="true"
        >
          {{ option.shortLabel }}
        </span>
      </label>
    </fieldset>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.segmented {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: 0.8125rem;
}

.segmented__prefix {
  display: none;
  color: var(--color-ink-soft);

  @media (min-width: 768px) {
    display: inline;
  }
}

// Un `<fieldset>` nomme le groupe pour les lecteurs d'écran ; sa mise en forme native est remise à zéro.
.segmented__group {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  overflow: hidden;
}

.segmented__legend {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.segmented__option {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 32px;
  padding: 0 var(--space-3);
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;

  @media (pointer: coarse) {
    min-height: var(--touch);
  }

  // Survol souris : simple changement de couleur, sans animation.
  @include on-hover {
    &:not(:has(:checked)) {
      background: var(--color-cover-empty);
    }
  }

  &:has(:checked) {
    background: var(--color-ink);
    color: var(--color-surface);
  }

  // Le contour reste à l'intérieur : le groupe rogne ce qui dépasse.
  &:has(:focus-visible) {
    outline: 3px solid var(--color-blue);
    outline-offset: -3px;
  }
}

// Le bouton radio couvre toute l'option, invisible : le clic et le toucher l'atteignent.
.segmented__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

// Au mobile : le libellé court à la place de l'icône, ou l'icône seule s'il n'y en a pas.
// Au bureau : l'icône et le libellé entier.
.segmented__icon--desktop-only {
  display: none;

  @media (min-width: 768px) {
    display: inline-block;
  }
}

.segmented__text--short {
  @media (min-width: 768px) {
    display: none;
  }
}

.segmented__text--long {
  @media (max-width: 767px) {
    display: none;
  }
}
</style>
