<script setup lang="ts">
defineProps<{
  title: string
  type: 'series' | 'oneshot' | 'anthology'
  coverUrl?: string
}>()
const { t } = useI18n()
</script>

<template>
  <article class="work-card">
    <WorkCover :url="coverUrl" />
    <div class="work-card__body">
      <h3 class="work-card__title">{{ title }}</h3>
      <UiChip>{{ t(`workType.${type}`) }}</UiChip>
    </div>
  </article>
</template>

<style scoped lang="scss">
.work-card {
  display: grid;
  gap: var(--space-2);
}

.work-card__body {
  display: grid;
  justify-items: start;
  gap: var(--space-1);
}

.work-card__title {
  color: var(--color-ink);
  font-size: 1rem;
}
</style>
