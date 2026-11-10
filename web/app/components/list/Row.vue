<script setup lang="ts">
import type { LibraryEntryChanges, LibraryStatus } from '~/utils/library'
import type { ListedEntry } from '~/utils/reading-list'
import { translatedCode } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

/**
 * A work of the list: cover, title, status, chapter and volume counters (independent), rating
 * and access to the "Edit my reading" window.
 */
const props = withDefaults(
  defineProps<{ item: ListedEntry; counterKey?: number; isReadOnly?: boolean }>(),
  { counterKey: 0, isReadOnly: false },
)
const emit = defineEmits<{ change: [changes: LibraryEntryChanges]; edit: [] }>()
const { t, te } = useI18n()
const localePath = useLocalePath()

const work = computed(() => props.item.work)
/** Localised address of the work page. */
const path = computed(() => localePath(`/work/${workSlug(work.value.id, work.value.title)}`))
/** "Type · Formats" line under the title. */
const kindLine = computed(() =>
  [
    t(`workType.${work.value.type}`),
    ...work.value.formats.map((code) => translatedCode(t, te, 'genre', code)),
  ].join(' · '),
)
/** "8/10", or the "no rating" text. */
const ratingLabel = computed(() =>
  props.item.entry.rating === null
    ? t('library.noRating')
    : t('list.ratingOutOfTen', { value: props.item.entry.rating }),
)
/** "of 12", or "of ?" when the published total is unknown. */
const totalLabel = (total: number | null) =>
  total === null ? t('library.ofUnknown') : t('library.of', { total })

/** Reports a status change. */
const changeStatus = (status: LibraryStatus) => emit('change', { status })
</script>

<template>
  <article class="row" data-testid="list-row">
    <div class="row__work">
      <NuxtLink :to="path" class="row__cover" tabindex="-1" aria-hidden="true">
        <WorkCover :url="coverUrl(work.coverPath)" size="sm" />
      </NuxtLink>
      <div class="row__title-block">
        <h3 class="row__title">
          <NuxtLink :to="path" class="row__link">{{ work.title }}</NuxtLink>
        </h3>
        <p class="row__kind">{{ kindLine }}</p>
      </div>
    </div>

    <div class="row__status">
      <span
        v-if="isReadOnly"
        class="row__status-badge"
        :style="{ background: `var(--status-${item.entry.status})` }"
        data-testid="list-status"
      >
        {{ t(`readingStatus.${item.entry.status}`) }}
      </span>
      <ListStatusButton
        v-else
        :status="item.entry.status"
        :title="work.title"
        @change="changeStatus"
      />
      <!-- On mobile the rating follows the status; on desktop it has its own column. -->
      <span v-if="item.entry.rating !== null" class="row__rating-mobile">
        {{ ratingLabel }}
      </span>
    </div>

    <div class="row__counter" data-testid="list-chapters">
      <p v-if="isReadOnly" class="row__read-value">
        <span class="row__read-label">{{ t('counter.chapters.unit') }}</span>
        {{ item.entry.chaptersRead }}
      </p>
      <UiCounter
        v-else
        :key="`chapters-${counterKey}`"
        compact
        :model-value="item.entry.chaptersRead"
        :label="t('counter.chapters.unit')"
        @update:model-value="emit('change', { chaptersRead: $event })"
      />
      <small class="row__total">{{ totalLabel(work.chapters) }}</small>
    </div>

    <div class="row__counter" data-testid="list-volumes">
      <p v-if="isReadOnly" class="row__read-value">
        <span class="row__read-label">{{ t('counter.volumes.unit') }}</span>
        {{ item.entry.volumesRead }}
      </p>
      <UiCounter
        v-else
        :key="`volumes-${counterKey}`"
        compact
        :model-value="item.entry.volumesRead"
        :label="t('counter.volumes.unit')"
        @update:model-value="emit('change', { volumesRead: $event })"
      />
      <small class="row__total">{{ totalLabel(work.volumes) }}</small>
    </div>

    <p class="row__rating" data-testid="list-rating">{{ ratingLabel }}</p>

    <UiButton
      v-if="!isReadOnly"
      variant="secondary"
      size="small"
      class="row__edit"
      :aria-label="t('list.editTitle', { title: work.title })"
      data-testid="list-edit"
      @click="emit('edit')"
    >
      <Icon name="tabler:pencil" size="14" aria-hidden="true" />
      <span class="row__edit-label">{{ t('action.edit') }}</span>
    </UiButton>
  </article>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px dashed var(--color-rule);

  &:last-child {
    border-bottom: 0;
  }

  // Desktop: the columns of the `pages/list.vue` header (`--list-columns`).
  @media (min-width: 1024px) {
    grid-template-columns: var(--list-columns);
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }
}

.row__work {
  display: contents;

  @media (min-width: 1024px) {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
}

.row__cover {
  display: block;
  grid-row: 1 / span 3;
  align-self: start;

  @media (min-width: 1024px) {
    flex: none;
    grid-row: auto;
  }
}

// Rows placed by hand on mobile: the edit button shares the first row, and
// automatic placement would push the title under the cover.
.row__title-block {
  grid-row: 1;
  grid-column: 2 / -1;
  min-width: 0;
  padding-right: var(--touch);

  @media (min-width: 1024px) {
    grid-row: auto;
    grid-column: auto;
    padding-right: 0;
  }
}

.row__title {
  margin: 0;
  color: var(--color-blue);
  font-size: 0.9375rem;
  overflow-wrap: anywhere;
}

.row__link {
  color: inherit;
  text-decoration: none;

  @include on-hover {
    text-decoration: underline;
  }
}

.row__kind {
  margin: 2px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.row__status {
  display: flex;
  grid-row: 2;
  grid-column: 2 / -1;
  align-items: center;
  gap: var(--space-3);

  @media (min-width: 1024px) {
    grid-row: auto;
    grid-column: auto;
  }
}

.row__rating-mobile {
  font-size: 0.8125rem;
  font-weight: 800;

  @media (min-width: 1024px) {
    display: none;
  }
}

.row__counter {
  display: grid;
  grid-row: 3;
  justify-items: start;
  gap: 2px;

  @media (min-width: 1024px) {
    grid-row: auto;
    justify-items: center;

    // On desktop the column header carries the label: it is still read by screen readers.
    :deep(.counter__label) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  :deep(.counter) {
    justify-items: start;

    @media (min-width: 1024px) {
      justify-items: center;
    }
  }
}

// Read-only: the value replaces the counter, its label is only visible on mobile.
.row__read-value {
  margin: 0;
  font-weight: 800;
}

.row__read-label {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 400;

  @media (min-width: 1024px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

.row__status-badge {
  justify-self: start;
  padding: 2px var(--space-2);
  border: 2px solid var(--color-ink);
  border-radius: var(--radius);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 800;
}

.row__total {
  display: none;
  color: var(--color-ink-soft);
  font-size: 0.6875rem;

  @media (min-width: 1024px) {
    display: block;
  }
}

.row__rating {
  display: none;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 800;

  @media (min-width: 1024px) {
    display: block;
  }
}

// No `position` here: a button's hover switches it to `relative` and would shift an absolute one.
.row__edit {
  grid-row: 1;
  grid-column: 3;
  align-self: start;
  justify-self: end;
  padding: 0;
  min-width: var(--touch);

  @media (min-width: 1024px) {
    grid-row: auto;
    grid-column: auto;
    align-self: center;
    min-width: 0;
    padding: 0 var(--space-3);
  }
}

.row__edit-label {
  @media (max-width: 1023px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
