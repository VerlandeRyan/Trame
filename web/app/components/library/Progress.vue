<script setup lang="ts">
import {
  exceedsKnownTotal,
  RATING_MAX,
  type LibraryEntry,
  type LibraryEntryChanges,
} from '~/utils/library'

/**
 * "My progress": chapters read, volumes read and rating, then the reading dates (collapsed so
 * they do not push the synopsis down). The two counters are independent; the rating is 0 until
 * rated (shown as a dash).
 */
const props = defineProps<{
  entry: LibraryEntry
  /** Known published chapters / volumes (`null`: unknown, shown as "?"). */
  totalChapters: number | null
  totalVolumes: number | null
}>()
const emit = defineEmits<{ change: [changes: LibraryEntryChanges] }>()
const { t } = useI18n()

const titleId = useId()
const NO_RATING = 0

/** "of 12", or "of ?" when the total is unknown. */
const totalLabel = (total: number | null) =>
  total === null ? t('library.ofUnknown') : t('library.of', { total })

/** Whether more chapters are marked read than the catalogue knows. */
const chaptersExceedTotal = computed(() =>
  exceedsKnownTotal(props.entry.chaptersRead, props.totalChapters),
)
/** Whether more volumes are marked read than the catalogue knows. */
const volumesExceedTotal = computed(() =>
  exceedsKnownTotal(props.entry.volumesRead, props.totalVolumes),
)

// A progress change may ask to change the status (`useReadingPrompt`); if nothing is saved, the
// counter may have displayed the typed value: recreate it so it reads the real one again.
const counterKey = ref(0)
const {
  isOpen: isAskingToRead,
  title: promptTitle,
  text: promptText,
  confirmLabel: promptConfirmLabel,
  cancelLabel: promptCancelLabel,
  request: requestPrompt,
  confirm: confirmPrompt,
  decline: declinePrompt,
} = useReadingPrompt()

/** Reports a counter change, after the confirmation if one is needed. */
function changeProgress(changes: LibraryEntryChanges) {
  const isAsking = requestPrompt(
    props.entry,
    { chapters: props.totalChapters, volumes: props.totalVolumes },
    changes,
    { apply: (confirmed) => emit('change', confirmed), discard: () => (counterKey.value += 1) },
  )
  if (!isAsking) emit('change', changes)
}

/** Reports a rating change; 0 removes the rating. */
const changeRating = (rating: number) =>
  emit('change', { rating: rating === NO_RATING ? null : rating })

/** Reports a start or end date change; an empty value clears it. */
function changeDate(field: 'startedOn' | 'finishedOn', event: Event) {
  const date = (event.target as HTMLInputElement).value
  emit('change', { [field]: date === '' ? null : date })
}
</script>

<template>
  <!-- The confirmation window stays outside the panel: `container-type` would make it its reference. -->
  <div>
    <section class="progress" :aria-labelledby="titleId" data-testid="library-progress">
      <h2 :id="titleId" class="progress__title">{{ t('library.progress') }}</h2>

      <div class="progress__grid">
        <div class="progress__cell">
          <UiCounter
            :key="`chapters-${counterKey}`"
            compact
            :model-value="entry.chaptersRead"
            :label="t('counter.chapters.label')"
            @update:model-value="changeProgress({ chaptersRead: $event })"
          />
          <small class="progress__total">{{ totalLabel(totalChapters) }}</small>
          <small v-if="chaptersExceedTotal" class="progress__warning" data-testid="library-warning">
            {{ t('library.exceedsChapters', { total: totalChapters }) }}
          </small>
        </div>

        <div class="progress__cell">
          <UiCounter
            :key="`volumes-${counterKey}`"
            compact
            :model-value="entry.volumesRead"
            :label="t('counter.volumes.label')"
            @update:model-value="changeProgress({ volumesRead: $event })"
          />
          <small class="progress__total">{{ totalLabel(totalVolumes) }}</small>
          <small v-if="volumesExceedTotal" class="progress__warning" data-testid="library-warning">
            {{ t('library.exceedsVolumes', { total: totalVolumes }) }}
          </small>
        </div>

        <div class="progress__cell">
          <UiCounter
            compact
            :model-value="entry.rating ?? NO_RATING"
            :label="t('library.rating')"
            :max="RATING_MAX"
            :empty-label="t('library.noRating')"
            @update:model-value="changeRating"
          />
          <small class="progress__total">{{ t('library.ofTen') }}</small>
        </div>
      </div>

      <details class="progress__dates">
        <summary class="progress__dates-toggle" data-testid="library-dates-toggle">
          {{ t('library.dates') }}
          <Icon name="tabler:chevron-down" size="14" aria-hidden="true" />
        </summary>
        <div class="progress__dates-fields">
          <label class="progress__date">
            {{ t('library.startedOn') }}
            <input
              type="date"
              class="progress__date-input"
              :value="entry.startedOn ?? ''"
              data-testid="library-started"
              @change="changeDate('startedOn', $event)"
            />
          </label>
          <label class="progress__date">
            {{ t('library.finishedOn') }}
            <input
              type="date"
              class="progress__date-input"
              :value="entry.finishedOn ?? ''"
              data-testid="library-finished"
              @change="changeDate('finishedOn', $event)"
            />
          </label>
        </div>
      </details>
    </section>

    <UiConfirm
      v-model="isAskingToRead"
      :title="promptTitle"
      :text="promptText"
      :confirm-label="promptConfirmLabel"
      :cancel-label="promptCancelLabel"
      :close-label="t('action.close')"
      @confirm="confirmPrompt"
      @cancel="declinePrompt"
    />
  </div>
</template>

<style scoped lang="scss">
// White panel with a shadow, 13 px title, three columns separated by a
// rule, always side by side. When narrow, the counters tighten (the panel decides, not the screen).
.progress {
  container-type: inline-size;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.progress__title {
  padding: 9px var(--space-3) 0;
  font-size: 0.8125rem;
  font-weight: 800;
}

.progress__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.progress__cell {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1) var(--space-3);
  text-align: center;

  & + & {
    border-left: var(--border);
  }
}

@container (max-width: 26rem) {
  .progress__grid {
    --counter-gap: 4px;
    --counter-value-width: 2.5rem;
  }
}

@container (max-width: 20rem) {
  .progress__grid {
    --counter-value-width: 2rem;
  }
}

.progress__total {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

.progress__warning {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 700;
}

.progress__dates {
  border-top: var(--border);
}

.progress__dates-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
}

// The two dates side by side, even at 320 px: one row instead of two.
.progress__dates-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-2) var(--space-2);
}

.progress__date {
  display: grid;
  min-width: 0;
  gap: 2px;
  font-size: 0.625rem;
  font-weight: 700;
}

// Discreet fields: 32 px tall, 13 px text (an `<input type="date">` opens a native picker,
// it does not trigger Safari iOS's zoom like a text field).
.progress__date-input {
  min-width: 0;
  min-height: 32px;
  padding: 0 var(--space-1);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  font-size: 0.8125rem;
}
</style>
