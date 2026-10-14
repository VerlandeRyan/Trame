<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const localePath = useLocalePath()

const notFound = computed(() => props.error.statusCode === 404)
useHead({
  title: t(props.error.statusCode === 404 ? 'errorPage.notFoundTitle' : 'errorPage.title'),
})

function goHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <NuxtLayout>
    <UiEmptyState
      :title="t(notFound ? 'errorPage.notFoundTitle' : 'errorPage.title')"
      :text="t(notFound ? 'errorPage.notFoundText' : 'errorPage.text')"
    >
      <UiButton variant="primary" @click="goHome">{{ t('errorPage.backHome') }}</UiButton>
    </UiEmptyState>
  </NuxtLayout>
</template>
