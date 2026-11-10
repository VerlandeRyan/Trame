<script setup lang="ts">
import { pickExploreCodes, type GenreItem } from '~/utils/home'
import { translatedCode } from '~/utils/search'

/** Home "Explore" block: shortcuts to the main formats and genres. */
const props = defineProps<{ genres: GenreItem[] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()

const exploreCodes = computed(() => pickExploreCodes(props.genres))

/** Translated label of a format or genre code. */
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

// Each row takes the full width. 16 px gap: the hover tilt overflows a little, and
// touch click areas must not overlap.
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

// Default for genres; formats and "All the…" override it below.
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

  // Click area: the pill itself with a mouse, 8 px around it with a finger.
  &::after {
    position: absolute;
    inset: 0;
    content: '';

    @media (pointer: coarse) {
      inset: -8px;
    }
  }

  // 1.2° rather than 2.5°: a wide pill moves more than a button for the same angle.
  @include tilt-on-hover(var(--color-rose-soft), wide);

  // With a finger, the pressed state replaces hover.
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

  @include tilt-on-hover(var(--color-rose), wide);

  &:active:not(:disabled) {
    background: var(--color-rose);
  }
}

.explore__link--all {
  box-shadow: none;
  background: var(--color-field-soft);

  @include tilt-on-hover(var(--color-cover-empty), wide);

  &:active:not(:disabled) {
    background: var(--color-cover-empty);
  }
}
</style>
