<script setup lang="ts">
/** Gallery of the base components, with fictitious data (no real catalogue data). */
import { COVER_SIZES, type CoverSize } from '~/utils/cover'
import type { LibraryStatus } from '~/utils/library'
import type { ListUnit, ListView } from '~/utils/reading-list'

definePageMeta({ middleware: 'component-gallery' })

const { t } = useI18n()
useHead({ title: t('gallery.title') })

const coverSizes = Object.keys(COVER_SIZES) as CoverSize[]

const readingStatuses = ['reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'] as const

const sampleWorks = [
  { id: 1, title: 'Œuvre fictive A', type: 'series' as const },
  { id: 2, title: 'Œuvre fictive B', type: 'oneshot' as const },
  { id: 3, title: 'Œuvre fictive C', type: 'anthology' as const },
]

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
  recentAdditions: id === 1 ? 5 : 1,
  isPopular: id === 1,
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
const isConfirmOpen = ref(false)
const signInOpen = useSignInModal()
const sampleHandle = ref('lecteur')
const searchText = ref('')
const chaptersRead = ref(12)
const volumesRead = ref(2)
const listView = ref<ListView>('list')
const listUnit = ref<ListUnit>('chapters')
const viewOptions = computed(() => [
  { value: 'list' as const, label: t('list.viewList'), icon: 'tabler:list' },
  { value: 'grid' as const, label: t('list.viewGrid'), icon: 'tabler:layout-grid' },
])
const unitOptions = computed(() => [
  {
    value: 'chapters' as const,
    label: t('counter.chapters.unit'),
    icon: 'tabler:bookmark',
    shortLabel: t('list.chaptersShort'),
  },
  {
    value: 'volumes' as const,
    label: t('counter.volumes.unit'),
    icon: 'tabler:books',
    shortLabel: t('list.volumesShort'),
  },
])
const sampleStatus = ref<LibraryStatus>('reading')
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
        <UiCounter v-model="chaptersRead" :label="t('counter.chapters.label')" />
        <UiCounter v-model="volumesRead" :label="t('counter.volumes.label')" :max="99" />
        <WorkCover v-for="size in coverSizes" :key="size" :size="size" />
      </UiPanel>
      <UiField id="gallery-search" v-model="searchText" :label="t('nav.search')" />
      <UiSearchField v-model="searchText" :label="t('nav.search')" :placeholder="t('nav.search')" />
      <UiSearchField
        v-model="searchText"
        small
        :label="t('nav.search')"
        :placeholder="t('nav.search')"
      />
      <div class="gallery__row">
        <UiSegmented v-model="listView" :options="viewOptions" :label="t('list.viewLabel')" />
        <UiSegmented
          v-model="listUnit"
          :options="unitOptions"
          :label="t('list.unitLabel')"
          :prefix="t('list.unitPrefix')"
        />
      </div>
      <div class="gallery__menu">
        <LibraryStatusList
          :status="sampleStatus"
          testid-prefix="gallery-status"
          @change="sampleStatus = $event"
        >
          <template #trigger="{ isOpen, menuId, toggle }">
            <UiButton
              size="small"
              :status="sampleStatus"
              aria-haspopup="menu"
              :aria-expanded="isOpen"
              :aria-controls="menuId"
              @click="toggle"
            >
              {{ t(`readingStatus.${sampleStatus}`) }}
              <Icon name="tabler:chevron-down" size="14" aria-hidden="true" />
            </UiButton>
          </template>
        </LibraryStatusList>
      </div>
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

    <section class="gallery__section" data-testid="gallery-auth">
      <h2>{{ t('gallery.auth') }}</h2>
      <UiField
        id="gallery-handle"
        v-model="sampleHandle"
        :label="t('auth.handle.label')"
        :hint="t('auth.handle.hint')"
        :error="t('error.HANDLE_TAKEN')"
        prefix="@"
      />
      <UiButton block variant="secondary" href="#">{{ t('gallery.wideLink') }}</UiButton>
      <div class="gallery__row">
        <UiButton variant="secondary" @click="signInOpen = true">
          {{ t('gallery.openSignIn') }}
        </UiButton>
        <UiButton variant="secondary" @click="isConfirmOpen = true">
          {{ t('gallery.openConfirm') }}
        </UiButton>
      </div>
      <AuthNotice />
    </section>

    <UiStatePanel :title="t('gallery.emptyTitle')" :text="t('gallery.emptyText')" />
    <UiStatePanel tone="error" :title="t('errorPage.title')" :text="t('errorPage.text')" />
    <UiFormError>{{ t('error.HANDLE_TAKEN') }}</UiFormError>

    <UiModal v-model="isModalOpen" :title="t('action.add')" :close-label="t('action.close')">
      <p>{{ t('gallery.modalText') }}</p>
    </UiModal>

    <UiConfirm
      v-model="isConfirmOpen"
      :title="t('auth.handle.confirmCancel.title')"
      :text="t('auth.handle.confirmCancel.text')"
      :confirm-label="t('auth.handle.confirmCancel.confirm')"
      :cancel-label="t('auth.handle.confirmCancel.keep')"
      :close-label="t('action.close')"
    />
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

// Reserves room for the open status menu, so it does not cover what follows.
.gallery__menu {
  min-height: 15rem;
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
