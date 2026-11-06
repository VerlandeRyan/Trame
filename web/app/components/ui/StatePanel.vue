<script setup lang="ts">
// Panneau d'état : liste vide, aucun résultat, erreur de chargement, profil privé.
// `tone="error"` annonce le panneau comme une alerte ; `compact` resserre les marges (listes).
const props = withDefaults(
  defineProps<{
    title: string
    text?: string
    tone?: 'empty' | 'error'
    icon?: string
    compact?: boolean
  }>(),
  { tone: 'empty', text: undefined, icon: undefined },
)

const isError = computed(() => props.tone === 'error')
const iconName = computed(
  () => props.icon ?? (isError.value ? 'tabler:alert-triangle' : 'tabler:book-off'),
)
</script>

<template>
  <UiPanel
    class="state-panel"
    :class="{ 'state-panel--error': isError, 'state-panel--compact': compact }"
    :role="isError ? 'alert' : undefined"
  >
    <div class="state-panel__body">
      <span class="state-panel__badge">
        <Icon :name="iconName" size="28" aria-hidden="true" />
      </span>
      <h2 class="state-panel__title">{{ title }}</h2>
      <p v-if="text" class="state-panel__text">{{ text }}</p>
      <slot />
    </div>
  </UiPanel>
</template>

<style scoped lang="scss">
// Centré dans la hauteur que l'appelant lui donne (profil privé).
.state-panel {
  display: grid;
  align-content: center;
}

.state-panel__body {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.state-panel--compact .state-panel__body {
  padding: var(--space-3) var(--space-2);
}

.state-panel__badge {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--color-cover-empty);
  color: var(--color-ink);
}

.state-panel--compact .state-panel__badge {
  width: 3rem;
  height: 3rem;
}

.state-panel--error .state-panel__badge {
  background: var(--color-chip);
  color: var(--color-crimson);
}

.state-panel__title {
  color: var(--color-blue);
  font-size: 1.25rem;
}

.state-panel__text {
  max-width: 420px;
  margin: 0;
  color: var(--color-ink-soft);
}
</style>
