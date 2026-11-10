<script setup lang="ts">
import { MENU_PREFERRED_HEIGHT_PX, MENU_ROW_HEIGHT_PX } from '~/utils/menu'

/** Replaces the native select (unstylable menu): focus stays on the button, the active option is announced. */
const props = defineProps<{
  options: { value: string; label: string }[]
  /** Accessible name ("Sort by"). */
  label: string
  /** Visible label before the value (default: `label`). */
  prefix?: string
  triggerTestId?: string
  /** White frame, like `UiMultiSelect` (default: flat text). */
  boxed?: boolean
}>()
const model = defineModel<string>({ required: true })

const uid = useId()
const listboxId = `${uid}-listbox`
const open = ref(false)
// The menu opens under the button (it scrolls if room is short), and above only when the space
// below is too short; it never makes the page longer.
const menuHeight = ref(MENU_PREFERRED_HEIGHT_PX)
const isAbove = ref(false)
const placeMenu = useMenuPlacement()
const activeIndex = ref(-1)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const currentIndex = computed(() =>
  props.options.findIndex((option) => option.value === model.value),
)
// An empty prefix hides it: the parent then displays the label itself.
const prefixText = computed(() => props.prefix ?? props.label)
const currentLabel = computed(() => props.options[currentIndex.value]?.label ?? '')
const activeId = computed(() =>
  open.value && activeIndex.value >= 0 ? `${uid}-option-${activeIndex.value}` : undefined,
)

/** Opens the menu on the current option, placed under or above the button. */
function openMenu() {
  activeIndex.value = Math.max(currentIndex.value, 0)
  if (root.value) {
    const placement = placeMenu(
      root.value.getBoundingClientRect(),
      props.options.length * MENU_ROW_HEIGHT_PX,
    )
    isAbove.value = placement.isAbove
    menuHeight.value = placement.maxHeight
  }
  open.value = true
}

/** Closes the menu, optionally giving focus back to the button. */
function closeMenu(restoreFocus = false) {
  open.value = false
  activeIndex.value = -1
  if (restoreFocus) trigger.value?.focus()
}

/** Opens the menu, or closes it if open. */
function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

/** Selects the option at the index and closes the menu. */
function choose(index: number) {
  const option = props.options[index]
  if (option) model.value = option.value
  closeMenu(true)
}

/** Moves the active option up or down, wrapping around; opens the menu if closed. */
function move(step: 1 | -1) {
  if (!open.value) {
    openMenu()
    return
  }
  const count = props.options.length
  activeIndex.value = (activeIndex.value + step + count) % count
}

/** Jumps to the first option after the active one whose label starts with `letter` (wrapping). */
function jumpToLetter(letter: string) {
  const wanted = letter.toLocaleLowerCase()
  const count = props.options.length
  for (let offset = 1; offset <= count; offset++) {
    const index = (Math.max(activeIndex.value, 0) + offset) % count
    if (props.options[index]?.label.toLocaleLowerCase().startsWith(wanted)) {
      if (!open.value) openMenu()
      activeIndex.value = index
      return
    }
  }
}

/** Keyboard support: arrows, Home/End, letters, Enter/Space, Escape and Tab. */
function onKeydown(event: KeyboardEvent) {
  const isLetter = event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (!open.value) openMenu()
    activeIndex.value = event.key === 'Home' ? 0 : props.options.length - 1
  } else if (isLetter) {
    jumpToLetter(event.key)
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeMenu(true)
  } else if ((event.key === 'Enter' || event.key === ' ') && open.value) {
    // Confirms the active option; otherwise the button's native click opens the menu.
    event.preventDefault()
    choose(activeIndex.value)
  } else if (event.key === 'Tab') {
    closeMenu()
  }
}

/** Closes the menu on a press outside it. */
function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div
    ref="root"
    class="select"
    :class="{ 'select--boxed': boxed, 'select--labelled': prefixText }"
  >
    <span v-if="prefixText" class="select__prefix" aria-hidden="true">{{ prefixText }}</span>
    <button
      ref="trigger"
      type="button"
      class="select__trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="activeId"
      :aria-label="`${label} : ${currentLabel}`"
      :data-testid="triggerTestId"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="select__value">{{ currentLabel }}</span>
      <Icon name="tabler:chevron-down" size="14" aria-hidden="true" class="select__caret" />
    </button>

    <ul
      v-show="open"
      :id="listboxId"
      class="select__menu"
      :class="{ 'select__menu--above': isAbove }"
      :style="{ maxHeight: `${menuHeight}px` }"
      role="listbox"
      tabindex="-1"
      :aria-label="label"
    >
      <li
        v-for="(option, index) in options"
        :id="`${uid}-option-${index}`"
        :key="option.value"
        role="option"
        class="select__option"
        :class="{
          'select__option--active': index === activeIndex,
          'select__option--selected': option.value === model,
        }"
        :aria-selected="option.value === model"
        :data-value="option.value"
        @mouseenter="activeIndex = index"
        @click="choose(index)"
      >
        <Icon
          v-if="option.value === model"
          name="tabler:check"
          size="14"
          aria-hidden="true"
          class="select__check"
        />
        <span v-else class="select__check" aria-hidden="true" />
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.select {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
}

// The whole frame opens the menu: the button fills it, the prefix is clickable.
.select--boxed {
  min-height: var(--touch);
  padding-left: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  // Menu as wide as the frame, in blue so it is not confused with the fields it covers.
  // At least the frame's width, anchored to its right edge: a long label widens the menu
  // to the left instead of scrolling horizontally.
  .select__menu {
    inset: calc(100% + var(--space-1)) 0 auto auto;
    width: max-content;
    min-width: 100%;
    overflow-x: hidden;
  }

  .select__menu--above {
    inset: auto 0 calc(100% + var(--space-1)) auto;
  }

  &:has(.select__trigger[aria-expanded='true']) {
    border-color: var(--color-blue);
  }

  &:focus-within {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }

  .select__trigger:focus-visible {
    outline: none;
  }

  .select__trigger {
    flex: 1;
    align-self: stretch;
    justify-content: space-between;
    padding: 0 var(--space-3) 0 0;

    // The whole frame surface (margins and prefix included) opens the menu; the menu, placed after
    // in the DOM, stays on top.
    &::before {
      content: '';
      position: absolute;
      inset: 0;
    }
  }

  // On mobile, a framed sort shrinks to 'Sort by ▾': the value is still read, not displayed.
  @media (max-width: 767px) {
    &.select--labelled .select__value {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  @include on-hover {
    background: var(--color-cover-empty);
  }

  @include press-background(var(--color-cover-empty));
}

.select__prefix {
  color: var(--color-ink-soft);
  white-space: nowrap;
}

.select__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 28px;
  }
}

.select__trigger[aria-expanded='true'] .select__caret {
  transform: rotate(180deg);
}

.select__menu {
  position: absolute;
  inset: calc(100% - 4px) 0 auto auto;
  z-index: 20;
  min-width: 180px;
  max-height: 18rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  background: var(--color-surface);

  @include menu-open-animation;
}

.select__menu--above {
  inset: auto 0 calc(100% - 4px) auto;

  @include menu-open-animation($above: true);
}

.select__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  color: var(--color-ink);
  white-space: nowrap;
  cursor: pointer;
}

.select__option + .select__option {
  border-top: 1px dashed var(--color-rule);
}

// Single style of choice menus: the current choice in solid blue, the row targeted by keyboard or
// mouse with the hover background.
.select__option--selected {
  background: var(--color-blue);
  color: var(--color-surface);
  font-weight: 800;
}

.select__option--active:not(.select__option--selected) {
  background: var(--color-cover-empty);
}

.select__option--selected .select__check {
  color: var(--color-surface);
}

.select__check {
  display: inline-block;
  width: 14px;
  color: var(--color-blue);
}
</style>
