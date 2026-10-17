<script setup lang="ts">
import { circularIndex, swipeDirection, type FeaturedWork } from '~/utils/home'
import { translatedCode } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

const SLIDE_SHIFT_PX = 24

// Une œuvre à la fois, sans défilement automatique.
const props = defineProps<{ works: FeaturedWork[] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()
const headingId = `${useId()}-heading`

const position = ref(0)
// 1 : vers la suite. La transition glisse dans ce sens.
const direction = ref<1 | -1>(1)
// Repli sur la première œuvre si la liste raccourcit entre deux chargements.
const work = computed(() => props.works[position.value] ?? props.works[0])
const hasSeveral = computed(() => props.works.length > 1)
const slideShift = computed(() => `${direction.value * SLIDE_SHIFT_PX}px`)

function showAdjacentWork(step: 1 | -1) {
  direction.value = step
  position.value = circularIndex(position.value, step, props.works.length)
}

function showWorkAt(index: number) {
  if (index === position.value) return
  direction.value = index > position.value ? 1 : -1
  position.value = index
}

// Doigt ou stylet seulement : la souris a les flèches et les pastilles.
let swipeStart: { x: number; y: number } | null = null

function startSwipe(event: PointerEvent) {
  swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
}

function endSwipe(event: PointerEvent) {
  if (!swipeStart) return
  const step = swipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
  swipeStart = null
  if (step !== 0 && hasSeveral.value) showAdjacentWork(step)
}

const descriptionLine = computed(() => {
  const current = work.value
  if (!current) return ''
  const formats = current.formats.map((code) => translatedCode(t, te, 'genre', code))
  return [
    current.mainAuthor,
    t(`workType.${current.type}`),
    ...formats,
    t(`workStatus.${current.status}`),
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <section
    v-if="work"
    class="featured"
    aria-roledescription="carousel"
    :aria-labelledby="headingId"
    :style="{ '--slide-shift': slideShift }"
    data-testid="home-featured"
  >
    <div class="featured__header">
      <h2 :id="headingId" class="featured__title">{{ t('home.featured.title') }}</h2>
      <div v-if="hasSeveral" class="featured__controls">
        <button
          type="button"
          class="featured__control"
          :aria-label="t('home.featured.previous')"
          data-testid="featured-prev"
          @click="showAdjacentWork(-1)"
        >
          <Icon name="tabler:chevron-left" size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="featured__control"
          :aria-label="t('home.featured.next')"
          data-testid="featured-next"
          @click="showAdjacentWork(1)"
        >
          <Icon name="tabler:chevron-right" size="16" aria-hidden="true" />
        </button>
      </div>
    </div>
    <UiRule />

    <div
      class="featured__stage"
      data-testid="featured-stage"
      @pointerdown="startSwipe"
      @pointerup="endSwipe"
      @pointercancel="swipeStart = null"
    >
      <Transition name="featured-slide" mode="out-in">
        <UiPanel
          :key="work.id"
          class="featured__slide"
          role="group"
          aria-roledescription="slide"
          :aria-label="t('home.featured.slide', { current: position + 1, total: works.length })"
          data-testid="featured-slide"
        >
          <WorkCover :url="coverUrl(work.coverPath)" class="featured__cover" />
          <div class="featured__body">
            <div class="featured__head">
              <span class="featured__badge">{{ t('home.featured.badge') }}</span>
              <h3 class="featured__work" data-testid="featured-title">{{ work.title }}</h3>
              <p class="featured__meta">{{ descriptionLine }}</p>
            </div>
            <p v-if="work.synopsis" class="featured__synopsis">
              <strong>{{ t('home.featured.synopsis') }}</strong> {{ work.synopsis }}
            </p>
            <p class="featured__readers" data-testid="featured-readers">
              {{
                t(
                  'home.featured.readers',
                  { count: work.recentAdditions },
                  { plural: work.recentAdditions },
                )
              }}
            </p>
            <NuxtLink
              :to="localePath(`/work/${workSlug(work.id, work.title)}`)"
              class="featured__open"
              data-testid="featured-open"
            >
              {{ t('home.featured.open') }}
            </NuxtLink>
          </div>
        </UiPanel>
      </Transition>
    </div>

    <div v-if="hasSeveral" class="featured__dots">
      <button
        v-for="(_, index) in works"
        :key="index"
        type="button"
        class="featured__dot"
        :class="{ 'featured__dot--active': index === position }"
        :aria-label="t('home.featured.choose', { index: index + 1 })"
        :aria-current="index === position"
        data-testid="featured-dot"
        @click="showWorkAt(index)"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.featured__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.featured__title {
  color: var(--color-ink);
  font-size: 1.0625rem;
}

// 14 px : les zones tactiles de 44 px des flèches se touchent sans se recouvrir.
.featured__controls {
  display: flex;
  gap: 14px;
}

.featured__control {
  position: relative;
  display: grid;
  place-items: center;
  align-self: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;

  // Zone de clic : la flèche à la souris, 44 px au doigt.
  &::after {
    position: absolute;
    inset: 0;
    content: '';

    @media (pointer: coarse) {
      inset: -7px;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    transition:
      transform 0.12s ease-out,
      box-shadow 0.12s ease-out,
      background-color 0.15s;
  }

  @include on-hover {
    background: var(--color-rose);

    @media (prefers-reduced-motion: no-preference) {
      box-shadow: var(--shadow-small);
      transform: translate(-1px, -1px);
    }
  }

  // Au doigt, l'appui remplace le survol.
  &:active:not(:disabled) {
    background: var(--color-rose);
    box-shadow: none;
    transform: translate(1px, 1px);
  }
}

// `pan-y` : le défilement vertical reste au navigateur. `overflow-x: clip` empêche la carte qui
// glisse hors du cadre d'élargir la page ; la marge compense l'ombre de la carte.
.featured__stage {
  margin-right: -4px;
  padding-right: 4px;
  overflow-x: clip;
  touch-action: pan-y;
}

// Bureau : couverture à gauche du texte. Mobile : le badge et le titre sont à côté de la couverture,
// le reste (`display: contents` sur le corps) prend toute la largeur dessous.
.featured__slide {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-4) var(--space-3);
  align-items: start;
  padding: 14px;

  @media (min-width: 768px) {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
}

.featured__cover {
  width: 96px;
  flex: none;

  @media (min-width: 768px) {
    width: 110px;
  }
}

.featured__body {
  display: contents;

  @media (min-width: 768px) {
    display: block;
    min-width: 0;
  }

  > :not(.featured__head) {
    @media (max-width: 767px) {
      grid-column: 1 / -1;
    }
  }
}

// Au mobile, le haut du badge est aligné sur le haut de la couverture.
.featured__head {
  min-width: 0;
  align-self: start;
}

// Texte en crimson sur le blanc de la carte (contraste AA vérifié).
.featured__readers {
  margin: var(--space-2) 0 0;
  color: var(--color-crimson);
  font-size: 0.8125rem;
  font-weight: 700;
}

// En bloc (et non en ligne) : pas d'interligne au-dessus, le haut du badge touche le haut de la couverture.
.featured__badge {
  display: block;
  width: fit-content;
  margin-bottom: var(--space-2);
  padding: 1px 8px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-yellow);
  font-size: 0.6875rem;
  font-weight: 800;
}

.featured__work {
  color: var(--color-blue);
  font-size: 1.125rem;
  line-height: 1.15;

  @media (min-width: 768px) {
    font-size: 1.375rem;
  }
}

.featured__meta {
  margin: 4px 0 var(--space-2);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

// `--slide-shift` porte le sens : positif vers la suite.
@media (prefers-reduced-motion: no-preference) {
  .featured-slide-enter-active,
  .featured-slide-leave-active {
    transition:
      opacity 0.2s ease-out,
      transform 0.2s ease-out;
  }

  .featured-slide-enter-from {
    opacity: 0;
    transform: translateX(var(--slide-shift));
  }

  .featured-slide-leave-to {
    opacity: 0;
    transform: translateX(calc(-1 * var(--slide-shift)));
  }
}

// Hauteur réservée : la page ne saute pas d'une œuvre à l'autre.
.featured__synopsis {
  display: -webkit-box;
  min-height: 4.5em;
  max-width: 420px;
  margin: 0;
  overflow: hidden;
  font-size: 0.8125rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

// Même apparence que `UiButton`, mais c'est un lien.
.featured__open {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch);
  margin-top: var(--space-3);
  // Au mobile (grille), le lien ne s'étire pas sur toute la largeur de la carte.
  justify-self: start;
  padding: 0 var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-rose);
  color: var(--color-ink);
  font-weight: 700;
  text-decoration: none;

  @include tilt-on-hover(var(--color-rose-strong));

  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 var(--color-ink);
    transform: translate(2px, 2px);
  }
}

// Boutons côte à côte, sans recouvrement : 32 × 28 px à la souris, 32 × 44 px au doigt. Le rond de
// 14 px est dessiné au centre par `::before`.
.featured__dots {
  display: flex;
  justify-content: center;
  margin-top: 3px;

  @media (pointer: coarse) {
    margin-top: -5px;
  }
}

.featured__dot {
  position: relative;
  width: 32px;
  height: 28px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;

  @media (pointer: coarse) {
    height: 44px;
  }

  &::before {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border: var(--border);
    border-radius: 50%;
    background: var(--color-surface);
    content: '';

    @media (prefers-reduced-motion: no-preference) {
      transition:
        background-color 0.2s ease-out,
        transform 0.2s ease-out;
    }
  }

  // Jamais sur la pastille déjà sélectionnée.
  &:not(.featured__dot--active) {
    @include on-hover {
      &::before {
        background: var(--color-rose);
      }
    }

    &:active::before {
      background: var(--color-rose);
    }
  }
}

.featured__dot--active {
  cursor: default;

  &::before {
    background: var(--color-blue);

    @media (prefers-reduced-motion: no-preference) {
      transform: scale(1.2);
    }
  }
}
</style>
