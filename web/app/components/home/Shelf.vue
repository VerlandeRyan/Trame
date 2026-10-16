<script setup lang="ts">
import { formatRatingAverage } from '~/utils/home'
import type { WorkSummary } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

type ShelfWork = WorkSummary & { ratingAverage?: number; ratingCount?: number }

defineProps<{
  title: string
  works: ShelfWork[]
  /** Sans lien « Tout voir » quand aucune page ne correspond à la rangée. */
  seeAllTo?: string | { path: string; query: Record<string, string> }
  testId: string
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const headingId = `${useId()}-heading`

function ratingLabel(work: ShelfWork): string | null {
  if (work.ratingAverage === undefined || work.ratingCount === undefined) return null
  const average = formatRatingAverage(work.ratingAverage, locale.value)
  return `${average} · ${t('work.rating.count', work.ratingCount)}`
}
</script>

<template>
  <section class="shelf" :aria-labelledby="headingId" :data-testid="testId">
    <div class="shelf__header">
      <h2 :id="headingId" class="shelf__title">{{ title }}</h2>
      <NuxtLink
        v-if="seeAllTo"
        :to="seeAllTo"
        class="shelf__all"
        :aria-label="t('home.seeAllOf', { section: title })"
      >
        {{ t('home.seeAll') }}
      </NuxtLink>
    </div>
    <UiRule />

    <ul class="shelf__list">
      <li v-for="work in works" :key="work.id" class="shelf__item" data-testid="shelf-work">
        <NuxtLink
          :to="localePath(`/work/${workSlug(work.id, work.title)}`)"
          class="shelf__cover"
          tabindex="-1"
          aria-hidden="true"
        >
          <WorkCover :url="coverUrl(work.coverPath)" />
        </NuxtLink>
        <h3 class="shelf__work">
          <NuxtLink :to="localePath(`/work/${workSlug(work.id, work.title)}`)" class="shelf__link">
            {{ work.title }}
          </NuxtLink>
        </h3>
        <p v-if="work.mainAuthor" class="shelf__author">{{ work.mainAuthor }}</p>
        <p v-if="ratingLabel(work)" class="shelf__rating">{{ ratingLabel(work) }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.shelf__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.shelf__title {
  color: var(--color-ink);
  font-size: 1.0625rem;
}

.shelf__all {
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: underline;

  @media (prefers-reduced-motion: no-preference) {
    transition: color 0.15s;
  }

  @include on-hover {
    color: var(--color-blue-light);
  }
}

// Une seule ligne : autant d'œuvres que la largeur en permet, qui se la partagent. Les suivantes
// tombent sur des lignes de hauteur nulle, donc masquées, jamais coupées en deux.
.shelf__list {
  --shelf-item: 104px;

  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--shelf-item), 1fr));
  grid-template-rows: auto;
  grid-auto-rows: 0;
  gap: 0 12px;
  // Marge compensée : `overflow: hidden` ne rogne ni l'ombre ni le soulèvement des couvertures.
  margin: -4px -4px 0 0;
  padding: 4px 4px 0 0;
  overflow: hidden;

  @media (min-width: 768px) {
    --shelf-item: 136px;

    gap: 0 16px;
  }
}

.shelf__item {
  min-width: 0;
}

.shelf__cover {
  display: block;

  // Soulèvement au survol : souris seulement, et sans animation réduite.
  @media (prefers-reduced-motion: no-preference) {
    transition: transform 0.15s ease-out;
  }

  @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
    .shelf__item:hover & {
      transform: translateY(-3px);
    }
  }
}

.shelf__work {
  margin-top: 8px;
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1.2;
}

.shelf__link {
  color: var(--color-blue);
  text-decoration: none;

  @include on-hover {
    text-decoration: underline;
  }
}

.shelf__author {
  margin: 2px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

.shelf__rating {
  display: inline-block;
  margin: 5px 0 0;
  padding: 1px 6px;
  border-radius: var(--radius);
  background: var(--color-field-soft);
  font-size: 0.6875rem;
  font-weight: 800;
}
</style>
