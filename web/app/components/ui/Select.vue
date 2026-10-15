<script setup lang="ts">
// Remplace `<select>` (menu non stylable) : le focus reste sur le bouton, l'option active est annoncée.
const props = defineProps<{
  options: { value: string; label: string }[]
  /** Nom accessible (« Trier par »). */
  label: string
  /** Libellé visible devant la valeur (défaut : `label`). */
  prefix?: string
  triggerTestId?: string
}>()
const model = defineModel<string>({ required: true })

const uid = useId()
const listboxId = `${uid}-listbox`
const open = ref(false)
const activeIndex = ref(-1)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const currentIndex = computed(() =>
  props.options.findIndex((option) => option.value === model.value),
)
const currentLabel = computed(() => props.options[currentIndex.value]?.label ?? '')
const activeId = computed(() =>
  open.value && activeIndex.value >= 0 ? `${uid}-option-${activeIndex.value}` : undefined,
)

function openMenu() {
  activeIndex.value = Math.max(currentIndex.value, 0)
  open.value = true
}

function closeMenu(restoreFocus = false) {
  open.value = false
  activeIndex.value = -1
  if (restoreFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

function choose(index: number) {
  const option = props.options[index]
  if (option) model.value = option.value
  closeMenu(true)
}

function move(step: 1 | -1) {
  if (!open.value) {
    openMenu()
    return
  }
  const count = props.options.length
  activeIndex.value = (activeIndex.value + step + count) % count
}

/** Première option après l'option active dont le libellé commence par `letter` (circulaire). */
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
    // Valide l'option active ; sinon le clic natif du bouton ouvre le menu.
    event.preventDefault()
    choose(activeIndex.value)
  } else if (event.key === 'Tab') {
    closeMenu()
  }
}

function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="select">
    <span class="select__prefix" aria-hidden="true">{{ prefix ?? label }}</span>
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
.select {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
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
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
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

.select__option--selected {
  background: var(--color-field-soft);
  font-weight: 800;
}

.select__option--active {
  outline: 2px solid var(--color-blue);
  outline-offset: -2px;
}

.select__check {
  display: inline-block;
  width: 14px;
  color: var(--color-blue);
}
</style>
