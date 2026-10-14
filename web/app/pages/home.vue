<script setup lang="ts">
// Accueil provisoire : le contenu réel (À la une, explorer…) arrive avec le ticket #79.
// Le fichier s'appelle `home` ; `path: '/'` en fait la racine du site.
definePageMeta({ path: '/' })

const { t } = useI18n()
const localePath = useLocalePath()
const isGalleryLinkVisible = useRuntimeConfig().public.componentGallery

useHead({ title: t('app.name') })
</script>

<template>
  <div class="home">
    <h1 data-testid="home-title">{{ t('home.title') }}</h1>
    <p data-testid="home-intro">{{ t('home.intro') }}</p>
    <NuxtLink v-if="isGalleryLinkVisible" :to="localePath('/components')">
      {{ t('home.componentsLink') }}
    </NuxtLink>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: grid;
  gap: var(--space-4);
}
</style>
