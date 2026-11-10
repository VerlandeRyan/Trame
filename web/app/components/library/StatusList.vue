<script setup lang="ts">
import { LIBRARY_STATUSES, type LibraryStatus } from '~/utils/library'
import { shouldOpenAbove } from '~/utils/menu'

/**
 * Menu of the five reading statuses, shared by the work page and My list. The caller provides
 * the trigger (`trigger` slot) and, if needed, a footer action (`footer` slot).
 */
const props = defineProps<{
  status: LibraryStatus
  /** Prefix of the rows' test ids: `<prefix>-<status>`. */
  testidPrefix: string
  /** The menu takes the caller's full width instead of its trigger's. */
  block?: boolean
}>()
const emit = defineEmits<{ change: [status: LibraryStatus] }>()
const slots = useSlots()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
/** Finds the menu trigger inside the component. */
const findTrigger = () => root.value?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null
const { isOpen, close } = useDismissableMenu(root, () => findTrigger()?.focus())
const menuId = useId()

const ROW_HEIGHT = 44
const PANEL_PADDING = 16
// Footer row: one touch row and its separator line.
const FOOTER_HEIGHT = ROW_HEIGHT + 1
// Near the bottom of the screen, the menu opens above the trigger instead of being cut off.
const opensAbove = ref(false)

/** Opens or closes the menu, deciding first whether it opens above. */
function toggleMenu() {
  const trigger = findTrigger()
  if (!isOpen.value && trigger) {
    const menuHeight =
      LIBRARY_STATUSES.length * ROW_HEIGHT + PANEL_PADDING + (slots.footer ? FOOTER_HEIGHT : 0)
    opensAbove.value = shouldOpenAbove(
      trigger.getBoundingClientRect(),
      window.innerHeight,
      menuHeight,
    )
  }
  isOpen.value = !isOpen.value
}

/** Closes the menu and reports the status if it changed. */
function choose(status: LibraryStatus) {
  close({ restoreFocus: true })
  if (status !== props.status) emit('change', status)
}
</script>

<template>
  <div ref="root" class="status-list" :class="{ 'status-list--block': block }">
    <slot name="trigger" :is-open="isOpen" :menu-id="menuId" :toggle="toggleMenu" />
    <div
      v-show="isOpen"
      :id="menuId"
      class="status-list__panel"
      :class="{ 'status-list__panel--above': opensAbove }"
      role="menu"
    >
      <button
        v-for="candidate in LIBRARY_STATUSES"
        :key="candidate"
        type="button"
        class="status-list__item"
        role="menuitemradio"
        :aria-checked="candidate === status"
        :data-testid="`${testidPrefix}-${candidate}`"
        @click="choose(candidate)"
      >
        <Icon
          v-if="candidate === status"
          name="tabler:check"
          size="16"
          aria-hidden="true"
          class="status-list__check"
        />
        <span v-else class="status-list__check" aria-hidden="true" />
        <span
          class="status-list__dot"
          :style="{ background: `var(--status-${candidate})` }"
          aria-hidden="true"
        />
        {{ t(`readingStatus.${candidate}`) }}
      </button>
      <div v-if="$slots.footer" class="status-list__footer">
        <slot name="footer" :close="close" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.status-list {
  position: relative;
  display: inline-block;
}

.status-list--block {
  display: block;
}

.status-list__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 20;
  min-width: 10rem;
  overflow: hidden;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);

  @include menu-open-animation;

  .status-list--block > & {
    right: 0;
  }
}

.status-list__panel--above {
  top: auto;
  bottom: calc(100% + var(--space-1));

  @include menu-open-animation($above: true);
}

// Single style of choice menus: full-width rows separated by a dotted line, current choice
// in solid blue with the tick on the left. The footer gets the same rows through `:deep`.
.status-list__item,
.status-list__footer :deep(.status-list__item) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;

  // Hover and press do not change the current choice (solid blue).
  &:not([aria-checked='true'], .status-list__item--danger) {
    @include on-hover {
      background: var(--color-cover-empty);
    }

    @include press-background(var(--color-cover-empty));
  }
}

.status-list__item + .status-list__item {
  border-top: 1px dashed var(--color-rule);
}

.status-list__item[aria-checked='true'] {
  background: var(--color-blue);
  color: var(--color-surface);
}

// Red text: pale pink hover, like Archive (see the project hover and press conventions).
.status-list__footer :deep(.status-list__item--danger) {
  color: var(--color-crimson);

  @include on-hover {
    background: var(--color-chip);
  }

  @include press-background(var(--color-chip));
}

.status-list__dot {
  flex: none;
  width: 14px;
  height: 14px;
  border: var(--border);
  border-radius: 50%;
}

.status-list__check,
.status-list__footer :deep(.status-list__check) {
  display: inline-block;
  flex: none;
  width: 16px;
}

// Solid line: the footer action stands apart from the statuses.
.status-list__footer {
  border-top: var(--border);
  border-top-color: var(--color-blue);
}
</style>
