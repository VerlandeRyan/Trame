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
import { coverUrl, workSlug } from '~/utils/work'

// Couverture à ombre de statut, pastille « Ch. 12 » et boutons −1 / +1. Au doigt, la couverture suit
// le geste et laisse voir « +1 » / « −1 » dessous (comme MALClient) : glisser vers la gauche fait +1
// (on va vers la suite, comme le carrousel), vers la droite −1 ; un simple toucher ouvre la fiche.
const props = withDefaults(
  defineProps<{ item: ListedEntry; unit: ListUnit; isReadOnly?: boolean }>(),
  { isReadOnly: false },
)
const emit = defineEmits<{ change: [changes: LibraryEntryChanges] }>()
const { t } = useI18n()
const localePath = useLocalePath()

const MAX_COUNT = 99_999

const path = computed(() =>
  localePath(`/work/${workSlug(props.item.work.id, props.item.work.title)}`),
)
const progress = computed(() => unitProgress(props.item, props.unit))
const badge = computed(() =>
  t(props.unit === 'chapters' ? 'list.badgeChapters' : 'list.badgeVolumes', {
    value: formatProgress(progress.value),
  }),
)
const unitLabel = computed(() => t(props.unit === 'chapters' ? 'list.chapters' : 'list.volumes'))

// Change à chaque −1 / +1 : la pastille est recréée et rejoue son petit rebond.
const bumpKey = ref(0)

function changeCounterBy(step: 1 | -1) {
  const next = progress.value.read + step
  if (next < 0 || next > MAX_COUNT) return
  emit('change', props.unit === 'chapters' ? { chaptersRead: next } : { volumesRead: next })
  bumpKey.value += 1
}

let swipeStart: { x: number; y: number } | null = null
let hasSwiped = false
// Décalage de la couverture pendant le geste (px) ; 0 au repos : elle revient en rebondissant.
const offset = ref(0)

const isDragging = computed(() => offset.value !== 0)
// Glissée vers la gauche, la couverture laisse voir « +1 » à droite ; vers la droite, « −1 » à gauche.
const revealStep = computed(() => (offset.value < 0 ? '+1' : '−1'))
const coverStyle = computed(() => ({
  '--grid-status': `var(--status-${props.item.entry.status})`,
  '--drag-offset': `${offset.value}px`,
  '--drag-tilt': `${offset.value / 8}deg`,
  '--drag-progress': dragProgress(offset.value),
}))

function startSwipe(event: PointerEvent) {
  if (props.isReadOnly || event.pointerType !== 'touch') return
  swipeStart = { x: event.clientX, y: event.clientY }
  hasSwiped = false
}

function moveSwipe(event: PointerEvent) {
  if (!swipeStart) return
  offset.value = dragOffset(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
}

function cancelSwipe() {
  swipeStart = null
  offset.value = 0
}

function endSwipe(event: PointerEvent) {
  if (!swipeStart) return
  // 1 vers la gauche (la suite) : +1 ; −1 vers la droite : −1.
  const step = swipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y)
  cancelSwipe()
  if (step === 0) return
  hasSwiped = true
  changeCounterBy(step)
}

// Un glissement ne doit pas ouvrir la fiche.
function preventOpeningAfterSwipe(event: MouseEvent) {
  if (!hasSwiped) return
  hasSwiped = false
  event.preventDefault()
}
</script>

<template>
  <article class="grid-item" data-testid="list-grid-item">
    <div class="grid-item__stage" :style="coverStyle">
      <!-- Sous la couverture : la couleur du statut et « +1 » / « −1 », de plus en plus visibles. -->
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
  // L'ombre colorée de la couverture déborde de 6 px : le titre doit rester en dessous.
  gap: var(--space-3);
  min-width: 0;
}

.grid-item__stage {
  position: relative;
}

// Fond révélé par le glissement : couleur du statut, « +1 » / « −1 » qui apparaît avec le geste.
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

// Le statut est la couleur de l'ombre de la couverture (à la place de l'ombre d'encre). Pendant le
// geste la couverture suit le doigt ; au relâchement elle revient en rebondissant.
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
    // Un filet d'encre fin autour de la couleur la détache du fond.
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

  @include on-hover {
    background: var(--color-rose);
  }

  &:active:not(:disabled) {
    background: var(--color-rose);
  }
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

// La pastille grossit un instant à chaque −1 / +1, puis revient.
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
