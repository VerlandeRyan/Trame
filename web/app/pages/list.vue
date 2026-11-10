<script setup lang="ts">
import type { LibraryEntryChanges } from '~/utils/library'
import {
  countEntriesOfAllStatuses,
  parseListQuery,
  type ListedEntry,
  type ListUnit,
} from '~/utils/reading-list'

/** My reading list: the address carries the status tab, the search, the sort and the view. */
definePageMeta({ middleware: 'authenticated' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const state = computed(() => parseListQuery(route.query))
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
const isNarrow = useNarrowScreen()
const searchPlaceholder = computed(() =>
  t(isNarrow.value ? 'list.searchPlaceholderShort' : 'list.searchPlaceholder'),
)
const list = await useReadingList(state)

useSeoMeta({ title: () => t('list.title'), robots: 'noindex, nofollow' })

const { tabs, tab, sortOptions, sort, view, viewOptions, unitOptions, searchText, onSearchInput } =
  useListControls(state, list.statusCounts, '/list')

// The grid counts chapters or volumes, as chosen.
const unit = ref<ListUnit>('chapters')
/** Singular name of the counted unit. */
const unitName = computed(() =>
  t(unit.value === 'chapters' ? 'list.unitChapter' : 'list.unitVolume'),
)

// A change may ask for confirmation before being saved; if nothing is saved, the counters read
// the real value again.
const counterKey = ref(0)
/** Saves a change, or first asks the confirmation it needs. */
function changeEntryOrAskFirst(item: ListedEntry, changes: LibraryEntryChanges) {
  const isAsking = requestPrompt(
    item.entry,
    { chapters: item.work.chapters, volumes: item.work.volumes },
    changes,
    {
      apply: (confirmed) => list.changeEntry(item, confirmed),
      discard: () => (counterKey.value += 1),
    },
  )
  if (!isAsking) void list.changeEntry(item, changes)
}

const editedWorkId = ref<number | null>(null)
/**
 * Saves what was entered in the window; only a switch to "completed" can offer to set the
 * counters to the published totals (the other questions concern the +1 buttons).
 */
function saveEditedEntry(changes: LibraryEntryChanges) {
  const item = list.items.value.find((each) => each.work.id === editedWorkId.value)
  if (!item) return
  if (changes.status === 'completed') changeEntryOrAskFirst(item, changes)
  else void list.changeEntry(item, changes)
}
/** Whether the edit window is open. */
const isEditing = computed({
  get: () => editedWorkId.value !== null,
  set: (open: boolean) => {
    if (!open) editedWorkId.value = null
  },
})
/** The entry being edited. */
const editedItem = computed(
  () => list.items.value.find((item) => item.work.id === editedWorkId.value) ?? null,
)

// Empty list: no work at all and no active filter.
const isFilterActive = computed(() => state.value.status !== null || state.value.q !== '')
const isEmptyList = computed(
  () =>
    countEntriesOfAllStatuses(list.statusCounts.value) === 0 &&
    !isFilterActive.value &&
    !list.error.value,
)
const isLoading = computed(() => list.status.value === 'pending')

const sentinel = useLoadMoreOnScroll(list)
</script>

<template>
  <div class="list" :aria-busy="isLoading">
    <header class="list__head">
      <h1 class="list__title">{{ t('list.title') }}</h1>
      <UiSegmented
        v-if="!isEmptyList"
        v-model="view"
        class="list__view"
        :options="viewOptions"
        :label="t('list.viewLabel')"
      />
    </header>

    <UiStatePanel
      v-if="list.error.value && !list.items.value.length"
      tone="error"
      :title="t('errorPage.title')"
      :text="t('list.loadError')"
    >
      <UiButton data-testid="list-retry" @click="list.refresh()">{{ t('list.retry') }}</UiButton>
    </UiStatePanel>

    <UiStatePanel
      v-else-if="isEmptyList"
      :title="t('list.emptyTitle')"
      :text="t('list.emptyText')"
      data-testid="list-empty"
    >
      <UiButton :href="localePath('/search')">{{ t('list.explore') }}</UiButton>
    </UiStatePanel>

    <template v-else>
      <ListSummary :totals="list.totals.value" />

      <UiTabs v-model="tab" :tabs="tabs" :label="t('list.tabsLabel')" class="list__tabs" />

      <div class="list__tools">
        <UiSearchField
          v-model="searchText"
          class="list__search"
          :label="t('list.searchLabel')"
          :placeholder="searchPlaceholder"
          data-testid="list-search"
          @input="onSearchInput"
        />
        <UiSelect
          v-model="sort"
          boxed
          :options="sortOptions"
          :label="t('list.sortLabel')"
          trigger-test-id="list-sort"
          class="list__sort"
        />
      </div>

      <UiFormError v-if="list.errorKey.value" data-testid="list-error">
        {{ t(list.errorKey.value) }}
      </UiFormError>

      <!-- Grid: the number of works on the left, what the grid counts on the right, then the help. -->
      <div v-if="state.view === 'grid'" class="list__grid-head">
        <div class="list__grid-bar">
          <p class="list__count" data-testid="list-count">
            {{ t('list.workCount', { count: list.total.value }, list.total.value) }}
          </p>
          <UiSegmented
            v-model="unit"
            :options="unitOptions"
            :label="t('list.unitLabel')"
            :prefix="t('list.unitPrefix')"
          />
        </div>
        <!-- Swiping only exists with a finger: with a mouse the help talks about the buttons. -->
        <p v-if="list.items.value.length" class="list__hint" data-testid="list-grid-hint">
          <span class="list__hint-touch">{{ t('list.gridHint', { unit: unitName }) }}</span>
          <span class="list__hint-mouse">{{ t('list.gridHintMouse', { unit: unitName }) }}</span>
        </p>
      </div>

      <div class="list__results" :class="{ 'list__results--loading': isLoading }">
        <UiStatePanel
          v-if="!list.items.value.length"
          :title="t('list.noMatch')"
          :text="t('list.noMatchText')"
          data-testid="list-no-match"
        />

        <div v-else-if="state.view === 'grid'" class="list__grid" data-testid="list-grid">
          <ListGridItem
            v-for="item in list.items.value"
            :key="item.work.id"
            :item="item"
            :unit="unit"
            @change="changeEntryOrAskFirst(item, $event)"
          />
        </div>

        <div v-else class="list__table" data-testid="list-table">
          <div class="list__columns" aria-hidden="true">
            <span>{{ t('list.headerWork') }}</span>
            <span>{{ t('list.headerStatus') }}</span>
            <span class="list__column--center">{{ t('counter.chapters.label') }}</span>
            <span class="list__column--center">{{ t('counter.volumes.label') }}</span>
            <span>{{ t('list.headerRating') }}</span>
            <span />
          </div>
          <ListRow
            v-for="item in list.items.value"
            :key="item.work.id"
            :item="item"
            :counter-key="counterKey"
            @change="changeEntryOrAskFirst(item, $event)"
            @edit="editedWorkId = item.work.id"
          />
        </div>
      </div>

      <div ref="sentinel" class="list__more" data-testid="list-more">
        <p v-if="list.hasMore.value" class="list__progress">
          {{ t('list.loadingMore', { loaded: list.items.value.length, total: list.total.value }) }}
        </p>
        <UiFormError v-if="list.hasLoadMoreFailed.value">
          {{ t('list.loadMoreError') }}
        </UiFormError>
        <UiButton
          v-if="list.hasMore.value"
          variant="secondary"
          size="small"
          data-testid="list-load-more"
          @click="list.loadMore()"
        >
          {{ t('list.loadMore') }}
        </UiButton>
      </div>
    </template>

    <ListEditModal
      v-model="isEditing"
      :item="editedItem"
      @save="saveEditedEntry"
      @remove="editedItem && list.removeEntry(editedItem)"
    />

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
@use '~/assets/styles/mixins' as *;

// `minmax(0, 1fr)`: without it the single-line status pills widen the whole page.
.list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

.list__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list__title {
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.75rem;
}

// On a narrow screen the title takes the row: the toggle drops below but stays on the right.
.list__view {
  margin-left: auto;
}

// Low pills, no rule underneath; 44 px tall with a finger only.
.list__tabs.list__tabs {
  padding-bottom: 0;
  scrollbar-width: none;
  overflow-x: auto;
  border-bottom: 0;

  :deep(.tabs__tab) {
    min-height: 32px;
    font-size: 0.8125rem;

    // Mouse hover: a plain colour change, no animation.
    @include on-hover {
      &:not(.tabs__tab--active) {
        background: var(--color-cover-empty);
      }
    }

    @media (pointer: coarse) {
      min-height: var(--touch);
    }
  }
}

// A single row on mobile: search and sort at the same height (the framed sort is taller than 44 px).
.list__tools {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);

  @media (min-width: 768px) {
    align-items: center;
    gap: var(--space-3);
  }
}

.list__sort {
  flex: none;
}

// 16 px minimum field: Safari iOS does not zoom.
.list__search {
  flex: 1 1 0;
  min-width: 0;
}

.list__grid-head {
  display: grid;
  gap: var(--space-2);
}

.list__grid-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list__count {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 700;
}

// Mouse device: the buttons' help; with a finger: the swipe's.
.list__hint-mouse {
  display: none;

  @media (hover: hover) and (pointer: fine) {
    display: inline;
  }
}

.list__hint-touch {
  @media (hover: hover) and (pointer: fine) {
    display: none;
  }
}

.list__hint,
.list__progress {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

// While loading, the previous list stays displayed, faded.
.list__results--loading {
  opacity: 0.5;
}

.list__table {
  --list-columns: minmax(0, 1fr) 9rem 8.5rem 8.5rem 4.5rem 6.5rem;

  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.list__columns {
  display: none;

  @media (min-width: 1024px) {
    display: grid;
    grid-template-columns: var(--list-columns);
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border);
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    font-weight: 800;
  }
}

.list__column--center {
  text-align: center;
}

.list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  }
}

.list__more {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-height: 1px;
}
</style>
