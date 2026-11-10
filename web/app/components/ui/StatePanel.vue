<script setup lang="ts">
/**
 * State panel: empty list, no result, loading error, private profile. `tone="error"` announces
 * the panel as an alert. A single size, for every screen.
 */
const props = withDefaults(
  defineProps<{
    title: string
    text?: string
    tone?: 'empty' | 'error'
    icon?: string
  }>(),
  { tone: 'empty', text: undefined, icon: undefined },
)

const isError = computed(() => props.tone === 'error')
/** The given icon, or the default one for the tone. */
const iconName = computed(
  () => props.icon ?? (isError.value ? 'tabler:alert-triangle' : 'tabler:book-off'),
)
</script>

<template>
  <UiPanel
    class="state-panel"
    :class="{ 'state-panel--error': isError }"
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
// Centred within the height the caller gives it (private profile).
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

.state-panel__badge {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--color-cover-empty);
  color: var(--color-ink);
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
