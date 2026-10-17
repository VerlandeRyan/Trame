<script setup lang="ts">
// Galerie des composants de base, avec des données fictives (aucune donnée réelle du catalogue).
definePageMeta({ middleware: 'component-gallery' })

const { t } = useI18n()
useHead({ title: t('gallery.title') })

const readingStatuses = ['reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'] as const

const sampleWorks = [
  { id: 1, title: 'Œuvre fictive A', type: 'series' as const },
  { id: 2, title: 'Œuvre fictive B', type: 'oneshot' as const },
  { id: 3, title: 'Œuvre fictive C', type: 'anthology' as const },
]

// Accueil : mêmes données fictives que les autres exemples.
const sampleSummary = {
  originalLanguage: 'fr',
  status: 'ongoing' as const,
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Autrice Inventée',
}
const sampleFeatured = [1, 2].map((id) => ({
  ...sampleSummary,
  id,
  title: `Œuvre fictive ${id}`,
  originalTitle: `Œuvre fictive ${id}`,
  type: 'series' as const,
  synopsis: 'Résumé fictif de l’œuvre mise en avant, sur deux ou trois lignes.',
  recentAdditions: 5,
}))
const sampleRated = [1, 2, 3].map((id) => ({
  ...sampleSummary,
  id,
  title: `Œuvre fictive ${id}`,
  originalTitle: `Œuvre fictive ${id}`,
  type: 'series' as const,
  ratingAverage: 9.1 - id / 10,
  ratingCount: 100 + id,
}))
const sampleGenres = [
  { code: 'manga', category: 'format' as const },
  { code: 'webtoon', category: 'format' as const },
  { code: 'fantasy', category: 'theme' as const },
]

const isModalOpen = ref(false)
const searchText = ref('')
const chaptersRead = ref(12)
const volumesRead = ref(2)
const activeTab = ref('all')
const tabs = computed(() => [
  { id: 'all', label: t('gallery.tabAll'), count: 53 },
  { id: 'reading', label: t('readingStatus.reading'), count: 4, status: 'reading' as const },
  {
    id: 'plan_to_read',
    label: t('readingStatus.plan_to_read'),
    count: 30,
    status: 'plan_to_read' as const,
  },
])
</script>

<template>
  <div class="gallery">
    <h1>{{ t('gallery.title') }}</h1>

    <section class="gallery__section">
      <h2>{{ t('gallery.buttons') }}</h2>
      <div class="gallery__row">
        <UiButton variant="primary">{{ t('action.addToList') }} +</UiButton>
        <UiButton variant="secondary" @click="isModalOpen = true">{{ t('action.add') }} +</UiButton>
        <UiButton v-for="status in readingStatuses" :key="status" :status="status">
          {{ t(`readingStatus.${status}`) }}
        </UiButton>
      </div>
    </section>

    <section class="gallery__section">
      <h2>{{ t('gallery.tabsAndCounters') }}</h2>
      <UiTabs v-model="activeTab" :tabs="tabs" :label="t('gallery.tabAll')" />
      <UiPanel class="gallery__progress">
        <UiCounter v-model="chaptersRead" :label="t('gallery.chaptersRead')" />
        <UiCounter v-model="volumesRead" :label="t('gallery.volumesRead')" :max="99" />
        <WorkCover size="small" />
      </UiPanel>
      <UiField id="gallery-search" v-model="searchText" :label="t('nav.search')" />
    </section>

    <section class="gallery__section">
      <h2>{{ t('gallery.relatedWorks') }}</h2>
      <UiRule />
      <ul class="gallery__grid">
        <li v-for="work in sampleWorks" :key="work.id">
          <WorkCard :title="work.title" :type="work.type" />
        </li>
      </ul>
    </section>

    <section class="gallery__section">
      <h2>{{ t('gallery.home') }}</h2>
      <HomeFeatured :works="sampleFeatured" />
      <HomeExplore :genres="sampleGenres" />
      <HomeShelf
        test-id="gallery-shelf"
        :title="t('home.topRated.title')"
        :works="sampleRated"
        see-all-to="/search"
      />
    </section>

    <UiEmptyState :title="t('gallery.emptyTitle')" :text="t('gallery.emptyText')" />

    <UiModal v-model="isModalOpen" :title="t('action.add')" :close-label="t('action.close')">
      <p>{{ t('gallery.modalText') }}</p>
    </UiModal>
  </div>
</template>

<style scoped lang="scss">
.gallery,
.gallery__section {
  display: grid;
  gap: var(--space-4);
}

.gallery__row,
.gallery__progress {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.gallery__progress {
  align-items: flex-end;
  gap: var(--space-6);
}

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .gallery__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
