<script setup lang="ts">
import { swipeDirection } from '~/utils/home'
import type { LibraryEntryChanges } from '~/utils/library'
import {
  dragOffset,
  dragProgress,
  formatProgress,
  unitProgress,
  type ListedEntry,
  type ListUnit,
} from '~/utils/reading-list'
import { counterKey } from '~/utils/units'
import { coverUrl, workSlug } from '~/utils/work'

/**
 * Cover with a status shadow, a "Ch. 12" badge and −1 / +1 buttons. With a finger, the cover
 * follows the gesture and reveals "+1" / "−1" underneath: dragging left adds one (moving forward,
 * like the carousel), dragging right removes one; a plain tap opens the work page.
 */
const props = withDefaults(
  defineProps<{ item: ListedEntry; unit: ListUnit; isReadOnly?: boolean }>(),
  { isReadOnly: false },
)
const emit = defineEmits<{ change: [changes: LibraryEntryChanges] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const MAX_COUNT = 99_999

/** Localised address of the work page. */
const path = computed(() =>
  localePath(`/work/${workSlug(props.item.work.id, props.item.work.title)}`),
)
/** Amount read and published total for the shown counter. */
const progress = computed(() => unitProgress(props.item, props.unit))
/** Text of the badge on the cover. */
const badge = computed(() =>
  t(counterKey(props.unit, 'compact'), { value: formatProgress(progress.value) }),
)
const unitLabel = computed(() => t(counterKey(props.unit, 'unit')))

// Changes on every −1 / +1: the badge is recreated and replays its small bounce.
const bumpKey = ref(0)

/** Reports the counter changed by one step, within bounds. */
function changeCounterBy(step: 1 | -1) {
  const next = progress.value.read + step
  if (next < 0 || next > MAX_COUNT) return
  emit('change', props.unit === 'chapters' ? { chaptersRead: next } : { volumesRead: next })
  bumpKey.value += 1
}

let swipeStart: { x: number; y: number } | null = null
let hasSwiped = false
// Offset of the cover during the gesture (px); 0 at rest: it springs back.
const offset = ref(0)

const isDragging = computed(() => offset.value !== 0)
const revealStep = computed(() => (offset.value < 0 ? '+1' : '−1'))
/** CSS variables that move and tilt the cover with the finger. */
const coverStyle = computed(() => ({
  '--grid-status': `var(--status-${props.item.entry.status})`,
  '--drag-offset': `${offset.value}px`,
  '--drag-tilt': `${offset.value / 8}deg`,
  '--drag-progress': dragProgress(offset.value),
}))

/** Starts tracking a touch swipe (not for the mouse, nor on a read-only list). */
function startSwipe(event: PointerEvent) {
  if (props.isReadOnly || event.pointerType !== 'touch') return
  swipeStart = { x: event.clientX, y: event.clientY }
  hasSwiped = false
}

/** Moves the cover with the finger. */
function moveSwipe(event: PointerEvent) {
  if (!swipeStart) return
  offset.value = dragOffset(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
}

/** Stops tracking and lets the cover spring back. */
function cancelSwipe() {
  swipeStart = null
  offset.value = 0
}

/** Commits the swipe as a −1 or +1 if it was long and horizontal enough. */
function endSwipe(event: PointerEvent) {
  if (!swipeStart) return
  const step = swipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
  cancelSwipe()
  if (step === 0) return
  hasSwiped = true
  changeCounterBy(step)
}

/** A swipe must not open the work page. */
function preventOpeningAfterSwipe(event: MouseEvent) {
  if (!hasSwiped) return
  hasSwiped = false
  event.preventDefault()
}
</script>

<template>
  <article class="grid-item" data-testid="list-grid-item">
    <div class="grid-item__stage" :style="coverStyle">
      <!-- Under the cover: the status colour and +1 / −1, increasingly visible. -->
      <div
        class="grid-item__reveal"
        :class="offset < 0 ? 'grid-item__reveal--end' : 'grid-item__reveal--start'"
        aria-hidden="true"
        data-testid="list-grid-reveal"
      >
        {{ isDragging ? revealStep : '' }}
      </div>
      <div
        class="grid-item__cover"
        :class="{ 'grid-item__cover--dragging': isDragging }"
        @pointerdown="startSwipe"
        @pointermove="moveSwipe"
        @pointerup="endSwipe"
        @pointercancel="cancelSwipe"
      >
        <NuxtLink
          :to="path"
          class="grid-item__link"
          :aria-label="item.work.title"
          @click="preventOpeningAfterSwipe"
        >
          <WorkCover :url="coverUrl(item.work.coverPath)" />
        </NuxtLink>
        <button
          v-if="!isReadOnly"
          type="button"
          class="grid-item__step grid-item__step--down"
          :disabled="progress.read === 0"
          :aria-label="t('counter.decrease', { label: unitLabel })"
          data-testid="list-grid-minus"
          @click="changeCounterBy(-1)"
        >
          −1
        </button>
        <button
          v-if="!isReadOnly"
          type="button"
          class="grid-item__step grid-item__step--up"
          :aria-label="t('counter.increase', { label: unitLabel })"
          data-testid="list-grid-plus"
          @click="changeCounterBy(1)"
        >
          +1
        </button>
        <span
          :key="bumpKey"
          class="grid-item__badge"
          :class="{ 'grid-item__badge--bump': bumpKey > 0 }"
          data-testid="list-grid-badge"
        >
          {{ badge }}
        </span>
      </div>
    </div>
    <h3 class="grid-item__title">
      <NuxtLink :to="path" class="grid-item__title-link" tabindex="-1">
        {{ item.work.title }}
      </NuxtLink>
    </h3>
  </article>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.grid-item {
  display: grid;
  align-content: start;
  // The cover's coloured shadow overflows by 6 px: the title must stay below it.
  gap: var(--space-3);
  min-width: 0;
}

.grid-item__stage {
  position: relative;
}

// Background revealed by the drag: status colour, with +1 / −1 appearing as the gesture goes.
.grid-item__reveal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--grid-status);
  color: var(--color-ink);
  font-size: 1.5rem;
  font-weight: 800;
  opacity: var(--drag-progress, 0);
  pointer-events: none;
}

.grid-item__reveal--end {
  justify-content: flex-end;
}

.grid-item__reveal--start {
  justify-content: flex-start;
}

// The status is the colour of the cover shadow (instead of the ink shadow). During the
// gesture the cover follows the finger; on release it springs back.
.grid-item__cover {
  position: relative;
  border-radius: var(--radius);
  touch-action: pan-y;
  transform: translateX(var(--drag-offset, 0)) rotate(var(--drag-tilt, 0));

  @media (prefers-reduced-motion: no-preference) {
    &:not(.grid-item__cover--dragging) {
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  }

  :deep(.cover) {
    // A thin ink outline around the colour separates it from the background.
    box-shadow:
      4px 4px 0 var(--grid-status),
      5px 5px 0 1px var(--color-ink);
  }
}

.grid-item__link {
  display: block;
}

.grid-item__step {
  position: absolute;
  top: var(--space-1);
  min-width: var(--touch);
  min-height: var(--touch);
  padding: 0 var(--space-1);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @include lift-on-hover;
}

.grid-item__step--down {
  left: var(--space-1);
}

.grid-item__step--up {
  right: var(--space-1);
}

.grid-item__badge {
  position: absolute;
  bottom: var(--space-1);
  left: var(--space-1);
  padding: 1px 6px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-size: 0.6875rem;
  font-weight: 800;
  pointer-events: none;
}

.grid-item__badge--bump {
  @media (prefers-reduced-motion: no-preference) {
    animation: badge-bump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

@keyframes badge-bump {
  from {
    transform: scale(1.35);
  }

  to {
    transform: scale(1);
  }
}

.grid-item__title {
  margin: 0;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.grid-item__title-link {
  color: var(--color-blue);
  text-decoration: none;

  @include on-hover {
    text-decoration: underline;
  }
}
</style>
