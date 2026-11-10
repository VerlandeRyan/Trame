<script setup lang="ts">
import { MENU_PREFERRED_HEIGHT_PX } from '~/utils/menu'
import { foldAccents } from '~/utils/work'

/**
 * Picks several values from a long list: a search field proposes those that remain, and the
 * chosen values appear below as removable pills.
 */
const props = defineProps<{
  label: string
  placeholder: string
  /** Text when no value matches the search. */
  emptyLabel: string
  /** Accessible name of a pill's cross. */
  removeLabel: (name: string) => string
  options: { value: string; label: string }[]
}>()
const model = defineModel<string[]>({ required: true })

const uid = useId()
const text = ref('')
const root = ref<HTMLElement | null>(null)
const field = ref<{ focus: () => void; getBoundingClientRect: () => DOMRect } | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => field.value?.focus())

// The list opens under the field (it scrolls if room is short), and above only when the space
// below is too short: it never makes the page longer.
const proposalsHeight = ref(MENU_PREFERRED_HEIGHT_PX)
const isAbove = ref(false)
const placeMenu = useMenuPlacement()
/** Places and opens the list of proposals. */
function openProposals() {
  if (field.value) {
    const placement = placeMenu(field.value.getBoundingClientRect())
    isAbove.value = placement.isAbove
    proposalsHeight.value = placement.maxHeight
  }
  isOpen.value = true
}

/** The chosen values with their labels (the code itself when unknown). */
const chosen = computed(() =>
  model.value.map(
    (value) =>
      props.options.find((option) => option.value === value) ?? {
        value,
        label: value,
      },
  ),
)
/** Options not yet chosen that match the typed text, ignoring accents. */
const proposals = computed(() => {
  const needle = foldAccents(text.value.trim())
  return props.options.filter(
    (option) => !model.value.includes(option.value) && foldAccents(option.label).includes(needle),
  )
})

/** Adds a value and closes the list. */
function add(value: string) {
  model.value = [...model.value, value]
  text.value = ''
  close()
}

/** Adds the first proposal, if any. */
function addFirstProposal() {
  const [first] = proposals.value
  if (first) add(first.value)
}

/** Removes a chosen value. */
const remove = (value: string) => (model.value = model.value.filter((code) => code !== value))
</script>

<template>
  <div ref="root" class="tags">
    <label :for="`${uid}-input`" class="tags__name">{{ label }}</label>
    <div class="tags__search">
      <UiSearchField
        :id="`${uid}-input`"
        ref="field"
        v-model="text"
        autocomplete="off"
        :placeholder="placeholder"
        data-testid="tag-input"
        @focus="openProposals"
        @click="openProposals"
        @input="openProposals"
        @keydown.enter.prevent="addFirstProposal"
      />
      <ul
        v-if="isOpen"
        class="tags__proposals"
        :class="{ 'tags__proposals--above': isAbove }"
        :style="{ maxHeight: `${proposalsHeight}px` }"
        data-testid="tag-proposals"
      >
        <li v-for="option in proposals" :key="option.value">
          <button
            type="button"
            class="tags__option"
            data-testid="tag-option"
            @click="add(option.value)"
          >
            {{ option.label }}
          </button>
        </li>
        <li v-if="proposals.length === 0" class="tags__none" data-testid="tag-none">
          {{ emptyLabel }}
        </li>
      </ul>
    </div>
    <ul v-if="chosen.length > 0" class="tags__chosen">
      <li v-for="option in chosen" :key="option.value" data-testid="tag-chosen">
        <button
          type="button"
          class="tags__chip"
          :aria-label="removeLabel(option.label)"
          @click="remove(option.value)"
        >
          {{ option.label }}
          <Icon name="tabler:x" size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.tags {
  display: grid;
  gap: var(--space-2);
}

.tags__name {
  font-weight: 700;
}

.tags__search {
  position: relative;
}

// Overlaid on the fields below: the card keeps its height while searching.
.tags__proposals {
  position: absolute;
  inset: calc(100% + var(--space-1)) 0 auto;
  z-index: 20;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  background: var(--color-surface);

  @include menu-open-animation;
}

.tags__proposals--above {
  inset: auto 0 calc(100% + var(--space-1));

  @include menu-open-animation($above: true);
}

.tags__option {
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;

  @include on-hover {
    background: var(--color-cover-empty);
  }

  &:focus-visible {
    background: var(--color-cover-empty);
  }
}

.tags__none {
  padding: var(--space-3);
  color: var(--color-ink-soft);
}

.tags__chosen {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
}

.tags__chip {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-ink);
  color: var(--color-surface);
  font-weight: 700;
  cursor: pointer;
}
</style>
