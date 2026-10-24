<script setup lang="ts">
// Panneau d'une section de formulaire : titre de section en bleu, phrase d'aide facultative, puis le
// contenu. Les noms de champ qu'il contient sont plus petits et plus discrets que le titre.
defineProps<{ title: string; hint?: string }>()
const titleId = useId()
</script>

<template>
  <section class="panel" :aria-labelledby="titleId">
    <header>
      <h2 :id="titleId" class="panel__title">{{ title }}</h2>
      <p v-if="hint" class="panel__hint">{{ hint }}</p>
    </header>
    <slot />
  </section>
</template>

<style scoped lang="scss">
.panel {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  :deep(.field__label),
  :deep(.pills__legend),
  :deep(.picker__name) {
    color: var(--color-ink-soft);
    font-size: 0.875rem;
    font-weight: 700;
  }
}

.panel__title {
  margin: 0;
  color: var(--color-blue);
  font-size: 1.25rem;
}

.panel__hint {
  margin: var(--space-1) 0 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
