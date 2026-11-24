<script setup lang="ts">
import type { LibraryStatus } from '~/contract/api'

/** One tab of the control. */
export interface UiTab {
  id: string
  label: string
  count?: number
  /** Reading status colour. */
  status?: LibraryStatus
  /** Alert text: the tab carries a red dot (an error to fix in this panel). */
  alert?: string
}

/** Tabs with keyboard navigation. `underline`: administration tabs, underlined text instead of pills. */
const props = withDefaults(defineProps<{ tabs: UiTab[]; label: string; underline?: boolean }>(), {
  underline: false,
})
const activeTabId = defineModel<string>({ required: true })
const tabButtons = ref<HTMLButtonElement[]>([])
const tablist = ref<HTMLElement | null>(null)

// Chevrons of underlined tabs: they signal tabs hidden on either side.
const hasHiddenBefore = ref(false)
const hasHiddenAfter = ref(false)
// A chevron also carries a dot when an alerted tab is hidden on its side.
const hasAlertBefore = ref(false)
const hasAlertAfter = ref(false)
// Share of the visible width covered by a click on a chevron.
const SCROLL_STEP_RATIO = 0.6
// Mirrors the chevron's size and offset in the styles below (30 px + 2 px): change them together.
const CHEVRON_COVER = 32

/** Updates which sides have hidden tabs, and whether an alert dot is hidden on one of them. */
function updateHiddenTabs() {
  const element = tablist.value
  if (!element) return
  hasHiddenBefore.value = element.scrollLeft > 1
  hasHiddenAfter.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
  const bar = element.getBoundingClientRect()
  const dots = [...element.querySelectorAll('.tabs__alert')].map((dot) =>
    dot.getBoundingClientRect(),
  )
  hasAlertBefore.value =
    hasHiddenBefore.value && dots.some((dot) => dot.left < bar.left + CHEVRON_COVER)
  hasAlertAfter.value =
    hasHiddenAfter.value && dots.some((dot) => dot.right > bar.right - CHEVRON_COVER)
}

/** Scrolls the tab list by a share of its visible width. */
function scrollTabs(direction: -1 | 1) {
  const element = tablist.value
  element?.scrollBy({ left: direction * element.clientWidth * SCROLL_STEP_RATIO })
}

/** Scrolls the active tab into view. */
function revealActiveTab() {
  const index = props.tabs.findIndex((tab) => tab.id === activeTabId.value)
  tabButtons.value[index]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
}

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  if (!props.underline) return
  revealActiveTab()
  updateHiddenTabs()
  if (typeof ResizeObserver === 'undefined' || !tablist.value) return
  resizeObserver = new ResizeObserver(updateHiddenTabs)
  resizeObserver.observe(tablist.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
watch(activeTabId, () => props.underline && nextTick(revealActiveTab))
// An alert, a label or a count can change a tab's width without any scroll; `post` measures after
// the DOM update. A string key, so that unrelated re-renders of the parent do not re-measure.
watch(
  () => props.tabs.map((tab) => `${tab.label}|${tab.count}|${tab.alert ? 1 : 0}`).join(),
  () => props.underline && updateHiddenTabs(),
  { flush: 'post' },
)

/** Index of the tab targeted by a navigation key; undefined if the key is not one. */
function targetIndexFor(key: string, currentIndex: number): number | undefined {
  const lastIndex = props.tabs.length - 1
  switch (key) {
    case 'ArrowRight':
      return currentIndex === lastIndex ? 0 : currentIndex + 1
    case 'ArrowLeft':
      return currentIndex === 0 ? lastIndex : currentIndex - 1
    case 'Home':
      return 0
    case 'End':
      return lastIndex
    default:
      return undefined
  }
}

/** Arrow, Home and End keys move the selection and the focus. */
function onKeydown(event: KeyboardEvent, currentIndex: number) {
  const targetIndex = targetIndexFor(event.key, currentIndex)
  const targetTab = targetIndex === undefined ? undefined : props.tabs[targetIndex]
  if (targetIndex === undefined || !targetTab) return

  event.preventDefault()
  activeTabId.value = targetTab.id
  tabButtons.value[targetIndex]?.focus()
}

/** Keeps a reference to each tab button, by index. */
function registerButton(element: unknown, index: number) {
  if (element) tabButtons.value[index] = element as HTMLButtonElement
}
</script>

<template>
  <div
    ref="tablist"
    class="tabs"
    :class="{ 'tabs--underline': underline }"
    role="tablist"
    :aria-label="label"
    @scroll.passive="updateHiddenTabs"
  >
    <span v-if="hasHiddenBefore" class="tabs__edge tabs__edge--start">
      <button
        type="button"
        class="tabs__arrow"
        tabindex="-1"
        aria-hidden="true"
        @click="scrollTabs(-1)"
      >
        <Icon name="tabler:chevron-left" size="16" />
        <span
          v-if="hasAlertBefore"
          class="tabs__arrow-alert"
          data-testid="tabs-arrow-alert-start"
        />
      </button>
    </span>
    <button
      v-for="(tab, index) in tabs"
      :key="tab.id"
      :ref="(element) => registerButton(element, index)"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'tabs__tab--active': tab.id === activeTabId }"
      :aria-selected="tab.id === activeTabId"
      :tabindex="tab.id === activeTabId ? 0 : -1"
      @click="activeTabId = tab.id"
      @keydown="onKeydown($event, index)"
    >
      <span
        v-if="tab.status"
        class="tabs__status-dot"
        :style="{ background: `var(--status-${tab.status})` }"
      />
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="tabs__count">{{ tab.count }}</span>
      <svg
        v-if="tab.alert"
        class="tabs__alert"
        viewBox="0 0 10 10"
        role="img"
        :aria-label="tab.alert"
      >
        <circle cx="5" cy="5" r="5" />
      </svg>
    </button>
    <span v-if="hasHiddenAfter" class="tabs__edge tabs__edge--end">
      <button
        type="button"
        class="tabs__arrow"
        tabindex="-1"
        aria-hidden="true"
        @click="scrollTabs(1)"
      >
        <Icon name="tabler:chevron-right" size="16" />
        <span v-if="hasAlertAfter" class="tabs__arrow-alert" data-testid="tabs-arrow-alert-end" />
      </button>
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.tabs {
  display: flex;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  overflow-x: auto;
  border-bottom: var(--border);
}

.tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;

  // Never on the current tab: a hover must not look like a selection.
  &:not(.tabs__tab--active) {
    @include on-hover {
      background: var(--color-cover-empty);

      // The count pill, of the same tint as this background, turns white to stay visible.
      .tabs__count {
        background: var(--color-surface);
      }
    }

    @include press-background(var(--color-cover-empty));

    &:active .tabs__count {
      background: var(--color-surface);
    }
  }
}

.tabs__tab--active {
  background: var(--color-ink);
  color: var(--color-surface);
}

// Two stacked lines: the bar's ink rule and the tab's blue line.
.tabs--underline {
  @include underline-tab-bar;

  gap: 0;

  .tabs__tab {
    // Le trait de l'onglet actif couvre l'onglet entier, pas seulement son texte.
    padding: 0 var(--space-4);

    @include underline-tab('tabs__tab--active');

    // The background stays the paper's: the pill keeps its resting tint.
    &:not(.tabs__tab--active) {
      @include on-hover {
        .tabs__count {
          background: var(--color-cover-blank);
        }
      }

      &:active .tabs__count {
        background: var(--color-cover-blank);
      }
    }
  }

  // Chevrons replace the scrollbar.
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .tabs--underline {
    scroll-behavior: smooth;
  }
}

// Zero-width slot attached to the scroll edge: the chevron stays visible while
// letting the tabs scroll underneath.
.tabs__edge {
  position: sticky;
  z-index: 1;
  flex: none;
  width: 0;

  &--start {
    left: 0;
  }

  &--end {
    right: 0;
  }
}

.tabs__arrow {
  position: absolute;
  top: calc(50% - 1.5px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 3px solid var(--color-rose);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
  transform: translateY(-50%);

  .tabs__edge--start & {
    left: 2px;
  }

  .tabs__edge--end & {
    right: 2px;
  }
}

// Same crimson as the tab's dot, ringed in the chevron's white so it stays readable on it.
.tabs__arrow-alert {
  position: absolute;
  top: -6px;
  right: -2px;
  width: 13px;
  height: 13px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-crimson);
}

.tabs__status-dot {
  width: 10px;
  height: 10px;
  border: 1px solid var(--color-ink);
  border-radius: 50%;
}

.tabs__alert {
  flex: none;
  width: 9px;
  height: 9px;
  fill: var(--color-crimson);
}

.tabs__count {
  padding: 0 6px;
  border-radius: var(--radius);
  background: var(--color-cover-blank);
  color: var(--color-ink);
  font-size: 0.75rem;
}
</style>
