<script setup lang="ts">
import { CONTINUE_READING_SIZE, incrementUnit } from '~/utils/home'
import { formatProgress, unitProgress, type ListedEntry } from '~/utils/reading-list'
import { translatedCode } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

// Bande « Reprendre la lecture » du hero connecté : les œuvres en cours, avec un +1 qui compte un
// chapitre (ou un tome pour une œuvre suivie par tomes) ; finir l'œuvre demande confirmation.
const props = defineProps<{ entries: ListedEntry[] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()
const headingId = `${useId()}-heading`

const { items, errorKey, readingPrompt, addOneToProgress } = useContinueReading(() => props.entries)

const workPath = (item: ListedEntry) =>
  localePath(`/work/${workSlug(item.work.id, item.work.title)}`)

function progressLine(item: ListedEntry): string {
  const unit = incrementUnit(item.entry)
  const format = translatedCode(t, te, 'genre', item.work.formats[0] ?? '')
  const progress = t(
    unit === 'chapters' ? 'home.continueReading.chapter' : 'home.continueReading.volume',
    { value: formatProgress(unitProgress(item, unit)) },
  )
  return item.work.formats.length ? `${format} · ${progress}` : progress
}

const addOneLabel = (item: ListedEntry) =>
  t(
    incrementUnit(item.entry) === 'chapters'
      ? 'home.continueReading.addChapter'
      : 'home.continueReading.addVolume',
    { title: item.work.title },
  )
</script>

<template>
  <!-- `v-show` : la bande disparaît quand la dernière œuvre est finie, sans perdre la confirmation. -->
  <section
    v-show="items.length"
    class="continue-reading"
    :style="{ '--continue-reading-count': Math.min(items.length, CONTINUE_READING_SIZE) }"
    :aria-labelledby="headingId"
    data-testid="home-continue-reading"
  >
    <div class="continue-reading__header">
      <h2 :id="headingId" class="continue-reading__title">
        {{ t('home.continueReading.title') }}
      </h2>
      <NuxtLink
        :to="localePath('/list')"
        class="continue-reading__see-list"
        data-testid="home-continue-reading-list-link"
      >
        {{ t('home.continueReading.seeList') }}
      </NuxtLink>
    </div>

    <ul class="continue-reading__list">
      <li
        v-for="item in items"
        :key="item.work.id"
        class="continue-reading__item"
        data-testid="continue-reading-work"
      >
        <NuxtLink
          :to="workPath(item)"
          class="continue-reading__cover"
          tabindex="-1"
          aria-hidden="true"
        >
          <WorkCover :url="coverUrl(item.work.coverPath)" size="small" />
        </NuxtLink>
        <div class="continue-reading__text">
          <h3 class="continue-reading__work-title">
            <NuxtLink :to="workPath(item)" class="continue-reading__link">
              {{ item.work.title }}
            </NuxtLink>
          </h3>
          <p class="continue-reading__progress">
            <span data-testid="continue-reading-progress">{{ progressLine(item) }}</span>
            <span
              class="continue-reading__status"
              :style="{ background: `var(--status-${item.entry.status})` }"
            >
              {{ t(`readingStatus.${item.entry.status}`) }}
            </span>
          </p>
        </div>
        <UiButton
          class="continue-reading__add-one"
          :aria-label="addOneLabel(item)"
          data-testid="continue-reading-add-one"
          @click="addOneToProgress(item)"
        >
          {{ t('home.continueReading.addOne') }}
        </UiButton>
      </li>
    </ul>

    <p
      v-if="errorKey"
      class="continue-reading__error"
      role="alert"
      data-testid="continue-reading-error"
    >
      {{ t(errorKey) }}
    </p>

    <UiConfirm
      v-model="readingPrompt.isOpen.value"
      :title="readingPrompt.title.value"
      :text="readingPrompt.text.value"
      :confirm-label="readingPrompt.confirmLabel.value"
      :cancel-label="readingPrompt.cancelLabel.value"
      :close-label="t('action.close')"
      @confirm="readingPrompt.confirm"
      @cancel="readingPrompt.decline"
    />
  </section>
</template>

<style scoped lang="scss">
// Au bureau la bande ne dépasse pas la largeur de ses cartes (trois colonnes de 12 px d'écart) :
// avec une ou deux œuvres, « Voir ma liste » reste collé à la dernière carte.
.continue-reading__header,
.continue-reading__list,
.continue-reading__error {
  @media (min-width: 768px) {
    max-width: calc(
      (100% - 2 * var(--space-3)) / 3 * var(--continue-reading-count) +
        (var(--continue-reading-count) - 1) * var(--space-3)
    );
  }
}

.continue-reading__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.continue-reading__title {
  color: var(--color-ink);
  font-size: 1.0625rem;
}

.continue-reading__see-list {
  color: var(--color-blue);
  font-size: 0.875rem;
  font-weight: 800;
}

// Mobile : cartes empilées ; bureau : jusqu'à trois côte à côte.
.continue-reading__list {
  display: grid;
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(var(--continue-reading-count), minmax(0, 1fr));
  }
}

.continue-reading__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

// Vignette plus étroite que `WorkCover small` (72 px) : la carte garde de la place pour le titre.
.continue-reading__cover {
  flex: none;
  width: 52px;

  :deep(.cover) {
    width: 100%;
  }
}

.continue-reading__text {
  flex: 1;
  min-width: 0;
}

.continue-reading__work-title {
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.continue-reading__link {
  color: var(--color-blue);
  text-decoration: none;
}

.continue-reading__progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 4px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.continue-reading__status {
  padding: 0 8px;
  border: var(--border);
  border-radius: var(--radius);
  color: var(--color-ink);
  font-size: 0.6875rem;
  font-weight: 800;
}

.continue-reading__add-one {
  flex: none;
  min-width: var(--touch);
  padding: 0 var(--space-2);
}

.continue-reading__error {
  margin: var(--space-2) 0 0;
  color: var(--color-crimson);
  font-weight: 700;
}
</style>
