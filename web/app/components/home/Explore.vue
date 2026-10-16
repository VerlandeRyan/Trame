<script setup lang="ts">
import { pickExploreCodes, type GenreItem } from '~/utils/home'
import { translatedCode } from '~/utils/search'

const props = defineProps<{ genres: GenreItem[] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()

const exploreCodes = computed(() => pickExploreCodes(props.genres))

function genreLabel(code: string) {
  return translatedCode(t, te, 'genre', code)
}
</script>

<template>
  <section class="explore" data-testid="home-explore">
    <h2 class="explore__title">{{ t('home.explore.title') }}</h2>
    <UiRule />

    <ul class="explore__list" :aria-label="t('home.explore.formats')">
      <li v-for="code in exploreCodes.formats" :key="code">
        <NuxtLink
          :to="{ path: localePath('/search'), query: { format: code } }"
          class="explore__link explore__link--format"
          :data-testid="`explore-format-${code}`"
        >
          {{ genreLabel(code) }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          :to="localePath('/search')"
          class="explore__link explore__link--format explore__link--all"
          data-testid="explore-all-formats"
        >
          {{ t('home.explore.allFormats') }} ›
        </NuxtLink>
      </li>
    </ul>

    <ul
      v-if="exploreCodes.themes.length > 0"
      class="explore__list"
      :aria-label="t('home.explore.genres')"
    >
      <li v-for="code in exploreCodes.themes" :key="code">
        <NuxtLink
          :to="{ path: localePath('/search'), query: { genre: code } }"
          class="explore__link explore__link--theme"
          :data-testid="`explore-genre-${code}`"
        >
          {{ genreLabel(code) }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          :to="localePath('/search')"
          class="explore__link explore__link--theme explore__link--all"
          data-testid="explore-all-genres"
        >
          {{ t('home.explore.allGenres') }} ›
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.explore__title {
  color: var(--color-ink);
  font-size: 1.0625rem;
}

// Chaque rangée occupe toute la largeur. 16 px d'écart : l'inclinaison au survol déborde un peu, et
// les zones de clic au doigt ne se recouvrent pas.
.explore__list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;

  & + & {
    margin-top: 16px;
  }

  > li {
    flex: 1 1 auto;

    @media (min-width: 768px) {
      min-width: 110px;
    }
  }
}

// Genres par défaut ; formats et « Tous les… » surchargent plus bas.
.explore__link {
  position: relative;
  display: block;
  padding: 3px 10px;
  text-align: center;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-chip);
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;

  // Zone de clic : la pastille à la souris, 8 px autour au doigt.
  &::after {
    position: absolute;
    inset: 0;
    content: '';

    @media (pointer: coarse) {
      inset: -8px;
    }
  }

  // 1,2° et non 2,5° : une pastille large dévie plus qu'un bouton pour le même angle.
  @include tilt-on-hover(var(--color-rose-soft), 1.03, -1.2deg);

  // Au doigt, l'appui remplace le survol.
  &:active:not(:disabled) {
    background: var(--color-rose-soft);
    transform: scale(0.96);
  }
}

.explore__link--format {
  padding: 5px 12px;
  box-shadow: var(--shadow-small);
  background: var(--color-surface);
  font-size: 0.8125rem;

  @include tilt-on-hover(var(--color-rose), 1.03, -1.2deg);

  &:active:not(:disabled) {
    background: var(--color-rose);
  }
}

.explore__link--all {
  box-shadow: none;
  background: var(--color-field-soft);

  @include tilt-on-hover(var(--color-cover-empty), 1.03, -1.2deg);

  &:active:not(:disabled) {
    background: var(--color-cover-empty);
  }
}
</style>
