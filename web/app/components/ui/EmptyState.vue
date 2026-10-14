<script setup lang="ts">
defineProps<{ title: string; text?: string }>()
</script>

<template>
  <section class="empty">
    <Icon name="tabler:book-off" size="40" aria-hidden="true" />
    <h2 class="empty__title">{{ title }}</h2>
    <p v-if="text" class="empty__text">{{ text }}</p>
    <slot />
  </section>
</template>

<style scoped lang="scss">
.empty {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  border: 2px dashed var(--color-rule);
  border-radius: var(--radius);
  text-align: center;
}

.empty__title {
  font-size: 1.125rem;
}

.empty__text {
  margin: 0;
  color: var(--color-ink-soft);
}
</style>
