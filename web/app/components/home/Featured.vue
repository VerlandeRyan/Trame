<script setup lang="ts">
import { circularIndex, swipeDirection, type FeaturedWork } from '~/utils/home'
import { translatedCode } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

/** Distance the slide travels during the transition. */
const SLIDE_SHIFT_PX = 24

/** Home carousel of featured works: one at a time, without automatic scrolling. */
const props = defineProps<{ works: FeaturedWork[] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()
const headingId = `${useId()}-heading`

const position = ref(0)
// 1: towards the next one. The transition slides in that direction.
const direction = ref<1 | -1>(1)
// Falls back to the first work if the list shrinks between two loads.
const work = computed(() => props.works[position.value] ?? props.works[0])
const hasSeveral = computed(() => props.works.length > 1)
const slideShift = computed(() => `${direction.value * SLIDE_SHIFT_PX}px`)

/** Shows the next or previous work, wrapping around. */
function showAdjacentWork(step: 1 | -1) {
  direction.value = step
  position.value = circularIndex(position.value, step, props.works.length)
}

/** Shows the work at the index, sliding in the matching direction. */
function showWorkAt(index: number) {
  if (index === position.value) return
  direction.value = index > position.value ? 1 : -1
  position.value = index
}

// Finger or stylus only: the mouse has the arrows and the dots.
let swipeStart: { x: number; y: number } | null = null

/** Remembers where a touch swipe starts. */
function startSwipe(event: PointerEvent) {
  swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
}

/** Moves to the next or previous work if the swipe is long and horizontal enough. */
function endSwipe(event: PointerEvent) {
  if (!swipeStart) return
  const step = swipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
  swipeStart = null
  if (step !== 0 && hasSeveral.value) showAdjacentWork(step)
}

/** "Author · Type · Formats · Status" line of the displayed work. */
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
          <WorkCover :url="coverUrl(work.coverPath)" size="xl" wide-size="hero" />
          <div class="featured__body">
            <div class="featured__head">
              <span class="featured__badge">{{
                t(work.isPopular ? 'home.featured.badge' : 'home.featured.badgeDiscover')
              }}</span>
              <h3 class="featured__work" data-testid="featured-title">{{ work.title }}</h3>
              <p class="featured__meta">{{ descriptionLine }}</p>
            </div>
            <p v-if="work.synopsis" class="featured__synopsis">
              <strong>{{ t('home.featured.synopsis') }}</strong> {{ work.synopsis }}
            </p>
            <p v-if="work.isPopular" class="featured__readers" data-testid="featured-readers">
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

// 14 px: the arrows' 44 px touch areas touch without overlapping.
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

  // Click area: the arrow itself with a mouse, 44 px with a finger.
  &::after {
    position: absolute;
    inset: 0;
    content: '';

    @media (pointer: coarse) {
      inset: -7px;
    }
  }

  @include lift-on-hover;
}

// `pan-y`: vertical scrolling stays with the browser. `overflow-x: clip` stops the sliding
// card from widening the page; the margin makes room for the card's shadow.
.featured__stage {
  margin-right: -4px;
  padding-right: 4px;
  overflow-x: clip;
  touch-action: pan-y;
}

// Desktop: cover left of the text. Mobile: the badge and title sit beside the cover, the rest
// (`display: contents` on the body) takes the full width below.
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

.featured__body {
  display: contents;

  // Desktop, three blocks over the cover's height: header on top, button at the bottom,
  // synopsis (and readers) spread between them.
  @media (min-width: 768px) {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    min-width: 0;
  }

  > :not(.featured__head) {
    @media (max-width: 767px) {
      grid-column: 1 / -1;
    }
  }
}

// On mobile, the top of the badge lines up with the top of the cover.
.featured__head {
  min-width: 0;
  align-self: start;
}

// Crimson text on the card's white (AA contrast checked).
.featured__readers {
  margin: var(--space-2) 0 0;
  color: var(--color-crimson);
  font-size: 0.8125rem;
  font-weight: 700;
}

// Block (not inline): no line spacing above, so the top of the badge touches the top of the cover.
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

// `--slide-shift` carries the direction: positive towards the next item.
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

// Reserved height: the page does not jump from one work to the next.
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

  // Desktop: the synopsis stays near the header, the free space sits before the button.
  @media (min-width: 768px) {
    margin-top: var(--space-6);
  }
}

// Looks like `UiButton`, but it is a link.
.featured__open {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch);
  margin-top: var(--space-3);
  // On mobile (grid), the link does not stretch over the card's full width.
  justify-self: start;
  padding: 0 var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-rose);
  color: var(--color-ink);
  font-weight: 700;
  text-decoration: none;

  // Desktop: button at the bottom of the body, at its natural width.
  @media (min-width: 768px) {
    align-self: flex-start;
    margin-top: auto;
  }

  @include tilt-on-hover(var(--color-rose-strong));

  @include press-down;
}

// Side-by-side buttons without overlap: 32 × 28 px with a mouse, 32 × 44 px with a finger. The
// 14 px dot is drawn in the centre by `::before`.
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

  // Never on the already selected dot.
  &:not(.featured__dot--active) {
    @include on-hover {
      &::before {
        background: var(--color-cover-empty);
      }
    }

    &:active::before {
      background: var(--color-cover-empty);
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
