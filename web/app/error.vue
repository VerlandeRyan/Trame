<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const localePath = useLocalePath()

const notFound = computed(() => props.error.status === 404)
useHead({
  title: t(props.error.status === 404 ? 'errorPage.notFoundTitle' : 'errorPage.title'),
})

function goHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <NuxtLayout>
    <!-- 404 : maquettes 24 (bureau) et 25 (mobile), avec la vraie recherche (#21). -->
    <section v-if="notFound" class="not-found" data-testid="not-found">
      <p class="not-found__code" aria-hidden="true">404</p>
      <h2 class="not-found__title">{{ t('errorPage.notFoundTitle') }}</h2>
      <p class="not-found__text">{{ t('errorPage.notFoundText') }}</p>
      <LayoutSearchBox class="not-found__search" />
      <UiButton variant="primary" @click="goHome">{{ t('errorPage.backHome') }}</UiButton>
    </section>

    <UiEmptyState v-else :title="t('errorPage.title')" :text="t('errorPage.text')">
      <UiButton variant="primary" @click="goHome">{{ t('errorPage.backHome') }}</UiButton>
    </UiEmptyState>
  </NuxtLayout>
</template>

<style scoped lang="scss">
.not-found {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: 22px 0;
  text-align: center;

  @media (min-width: 768px) {
    padding: 28px var(--space-6);
  }
}

.not-found__code {
  color: var(--color-blue);
  font-size: 4.5rem;
  font-weight: var(--weight-title);
  line-height: 1;

  @media (min-width: 768px) {
    font-size: 5.75rem;
  }
}

.not-found__title {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: 1.25rem;

  @media (min-width: 768px) {
    font-size: 1.375rem;
  }
}

.not-found__text {
  max-width: 420px;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.not-found__search {
  width: 100%;
  max-width: 460px;
  margin: var(--space-2) 0 var(--space-3);
  text-align: left;
}
</style>
