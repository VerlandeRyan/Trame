<script setup lang="ts">
import type { RecordRef } from '~/utils/admin'
import { menuMaxHeight, MENU_PREFERRED_HEIGHT_PX } from '~/utils/menu'

// Choisit un enregistrement du catalogue par recherche ; `search` est fourni par la page.
const props = defineProps<{
  label: string
  placeholder: string
  clearLabel: string
  search: (text: string) => Promise<RecordRef[]>
}>()
const model = defineModel<RecordRef | null>({ default: null })

const SEARCH_DELAY_MS = 200
const uid = useId()
const text = ref('')
const results = ref<RecordRef[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
// Les propositions se referment au clic à l'extérieur et reviennent quand on reprend la recherche.
const { isOpen, close } = useDismissableMenu(root, () => input.value?.focus())

// Seule la dernière recherche compte : une réponse plus lente qu'une frappe suivante est écartée.
let latestSearch = 0
async function runSearch(value: string) {
  const current = ++latestSearch
  let found: RecordRef[] = []
  try {
    found = await props.search(value)
  } catch {
    found = []
  }
  if (current !== latestSearch) return
  results.value = found
  showResults()
}

// La liste défile dans la place restante sous le champ, sans rallonger la page.
const resultsHeight = ref(MENU_PREFERRED_HEIGHT_PX)
function showResults() {
  if (input.value) {
    resultsHeight.value = menuMaxHeight(
      input.value.getBoundingClientRect().bottom,
      window.innerHeight,
    )
  }
  isOpen.value = results.value.length > 0
}

function onInput() {
  clearTimeout(timer)
  const value = text.value.trim()
  if (value === '') {
    results.value = []
    return
  }
  timer = setTimeout(() => runSearch(value), SEARCH_DELAY_MS)
}

function choose(record: RecordRef) {
  model.value = record
  text.value = ''
  results.value = []
  close()
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div ref="root" class="picker">
    <div v-if="model" class="picker__chosen" data-testid="picker-chosen">
      <span class="picker__label">{{ model.label }}</span>
      <button
        type="button"
        class="picker__clear"
        :title="clearLabel"
        :aria-label="clearLabel"
        data-testid="picker-clear"
        @click="model = null"
      >
        <Icon name="tabler:pencil" size="16" aria-hidden="true" />
      </button>
    </div>
    <template v-else>
      <label :for="`${uid}-input`" class="picker__name">{{ label }}</label>
      <input
        :id="`${uid}-input`"
        ref="input"
        v-model="text"
        class="picker__input"
        type="search"
        autocomplete="off"
        :placeholder="placeholder"
        data-testid="picker-input"
        @input="onInput"
        @focus="showResults"
        @click="showResults"
      />
      <ul
        v-if="isOpen && results.length > 0"
        class="picker__results"
        :style="{ maxHeight: `${resultsHeight}px` }"
        data-testid="picker-results"
      >
        <li v-for="record in results" :key="record.id">
          <button type="button" class="picker__option" @click="choose(record)">
            {{ record.label }}
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped lang="scss">
.picker {
  position: relative;
  display: grid;
  gap: var(--space-1);
}

.picker__name {
  font-weight: 700;
}

.picker__input {
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  font-size: 1rem;
}

.picker__chosen {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.picker__label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 700;
}

// Changer de choix : simple icône dans le cadre, pour ne pas la confondre avec le retrait de la ligne.
.picker__clear {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  margin-right: calc(var(--space-3) * -1);
  border: 0;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--color-ink);
  }
}

// Superposée aux champs du dessous : la carte ne change pas de hauteur pendant la recherche.
.picker__results {
  position: absolute;
  inset: calc(100% + var(--space-1)) 0 auto;
  z-index: 20;
  display: grid;
  max-height: 18rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.picker__option {
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--color-field-soft);
  }
}
</style>
