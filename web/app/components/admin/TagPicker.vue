<script setup lang="ts">
import { menuMaxHeight, MENU_PREFERRED_HEIGHT_PX, shouldOpenAbove } from '~/utils/menu'
import { foldAccents } from '~/utils/work'

// Choisit plusieurs valeurs dans une longue liste : un champ de recherche propose celles qui restent,
// les valeurs choisies s'affichent en pastilles retirables dessous.
const props = defineProps<{
  label: string
  placeholder: string
  /** Texte quand aucune valeur ne correspond à la recherche. */
  emptyLabel: string
  /** Nom accessible de la croix d'une pastille. */
  removeLabel: (name: string) => string
  options: { value: string; label: string }[]
}>()
const model = defineModel<string[]>({ required: true })

const uid = useId()
const text = ref('')
const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => input.value?.focus())

// La liste défile dans la place restante, sous le champ ou au-dessus s'il y en a plus : elle ne
// rallonge jamais la page.
const proposalsHeight = ref(MENU_PREFERRED_HEIGHT_PX)
const isAbove = ref(false)
function openProposals() {
  if (input.value) {
    const rect = input.value.getBoundingClientRect()
    isAbove.value = shouldOpenAbove(rect, window.innerHeight, MENU_PREFERRED_HEIGHT_PX)
    proposalsHeight.value = isAbove.value
      ? menuMaxHeight(window.innerHeight - rect.top, window.innerHeight)
      : menuMaxHeight(rect.bottom, window.innerHeight)
  }
  isOpen.value = true
}

const chosen = computed(() =>
  model.value.map(
    (value) =>
      props.options.find((option) => option.value === value) ?? {
        value,
        label: value,
      },
  ),
)
const proposals = computed(() => {
  const needle = foldAccents(text.value.trim())
  return props.options.filter(
    (option) => !model.value.includes(option.value) && foldAccents(option.label).includes(needle),
  )
})

function add(value: string) {
  model.value = [...model.value, value]
  text.value = ''
  close()
}

function addFirstProposal() {
  const [first] = proposals.value
  if (first) add(first.value)
}

const remove = (value: string) => (model.value = model.value.filter((code) => code !== value))
</script>

<template>
  <div ref="root" class="tags">
    <label :for="`${uid}-input`" class="tags__name">{{ label }}</label>
    <div class="tags__search">
      <input
        :id="`${uid}-input`"
        ref="input"
        v-model="text"
        type="search"
        class="tags__input"
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
  font-size: 0.875rem;
  font-weight: 700;
}

.tags__search {
  position: relative;
}

.tags__input {
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  // 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
  font-size: 1rem;
}

// Superposée aux champs du dessous : la carte ne change pas de hauteur pendant la recherche.
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
}

.tags__proposals--above {
  inset: auto 0 calc(100% + var(--space-1));
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
    background: var(--color-field-soft);
  }

  &:focus-visible {
    background: var(--color-field-soft);
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
