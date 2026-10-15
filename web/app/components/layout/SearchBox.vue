<script setup lang="ts">
import {
  MIN_QUERY_LENGTH,
  SUGGESTION_COUNT,
  normalizeQuery,
  translatedCode,
  type WorkPage,
} from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

// Combobox ARIA : le focus reste dans le champ, la suggestion active est annoncée.
const DEBOUNCE_MS = 200

const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const api = useApi()
const uid = useId()
const listboxId = `${uid}-listbox`
const inputId = `${uid}-input`

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const suggestions = ref<WorkPage | null>(null)
const open = ref(false)
const activeIndex = ref(-1)
const root = ref<HTMLElement | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
// Seule la dernière requête compte.
let latestRequest = 0
// Évite de relancer une requête déjà faite ou en cours quand le menu se rouvre.
let loadedFor = ''
let pendingFor = ''

const items = computed(() => suggestions.value?.items ?? [])
const total = computed(() => suggestions.value?.total ?? 0)
// +1 : la ligne « Voir les N résultats ».
const optionCount = computed(() => items.value.length + 1)
const expanded = computed(() => open.value && items.value.length > 0)
const activeId = computed(() =>
  expanded.value && activeIndex.value >= 0 ? `${uid}-option-${activeIndex.value}` : undefined,
)

function close() {
  open.value = false
  activeIndex.value = -1
}

function workPath(id: number, title: string) {
  return localePath(`/work/${workSlug(id, title)}`)
}

function resultsPath() {
  return { path: localePath('/search'), query: { q: normalizeQuery(query.value) } }
}

/** « Série · Manga · Auteur A » */
function formatWorkSummary(work: WorkPage['items'][number]): string {
  const formats = work.formats.map((code) => translatedCode(t, te, 'genre', code))
  return [t(`workType.${work.type}`), ...formats, work.mainAuthor].filter(Boolean).join(' · ')
}

async function load(text: string) {
  const request = ++latestRequest
  pendingFor = text
  try {
    const page = await api.request<WorkPage>('/works', {
      query: { q: text, lang: locale.value, pageSize: SUGGESTION_COUNT },
    })
    if (request !== latestRequest) return
    suggestions.value = page
    loadedFor = text
    activeIndex.value = -1
    open.value = true
  } catch {
    // Les suggestions sont facultatives : Entrée mène toujours aux résultats.
    if (request === latestRequest) close()
  } finally {
    if (request === latestRequest) pendingFor = ''
  }
}

function onInput() {
  clearTimeout(timer)
  const text = normalizeQuery(query.value)
  if (text.length < MIN_QUERY_LENGTH) {
    latestRequest++
    suggestions.value = null
    loadedFor = ''
    pendingFor = ''
    close()
    return
  }
  timer = setTimeout(() => void load(text), DEBOUNCE_MS)
}

function reopen() {
  const text = normalizeQuery(query.value)
  if (text.length < MIN_QUERY_LENGTH || open.value || pendingFor === text) return
  clearTimeout(timer)
  if (loadedFor === text && items.value.length > 0) open.value = true
  else void load(text)
}

function move(step: 1 | -1) {
  if (!expanded.value) {
    if (items.value.length > 0) open.value = true
    return
  }
  const from = activeIndex.value === -1 && step === -1 ? 0 : activeIndex.value
  activeIndex.value = (from + step + optionCount.value) % optionCount.value
}

// Échap ne vide pas le champ (comportement de Chrome) ; menu fermé, l'événement remonte à l'en-tête.
function onEscape(event: KeyboardEvent) {
  if (!expanded.value) return
  event.preventDefault()
  close()
}

async function submit() {
  clearTimeout(timer)
  const chosen = expanded.value ? activeIndex.value : -1
  close()
  const work = items.value[chosen]
  if (work) {
    await navigateTo(workPath(work.id, work.title))
    return
  }
  if (normalizeQuery(query.value).length >= MIN_QUERY_LENGTH) await navigateTo(resultsPath())
}

function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

const input = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => input.value?.focus() })

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  clearTimeout(timer)
})
watch(
  () => route.fullPath,
  () => {
    close()
    query.value = typeof route.query.q === 'string' ? route.query.q : ''
  },
)
</script>

<template>
  <div ref="root" class="search-box">
    <form class="search-box__form" role="search" @submit.prevent="submit">
      <Icon name="tabler:search" size="16" aria-hidden="true" class="search-box__icon" />
      <label :for="inputId" class="search-box__label">{{ t('search.label') }}</label>
      <input
        :id="inputId"
        ref="input"
        v-model="query"
        type="search"
        class="search-box__input"
        :class="{ 'search-box__input--open': expanded }"
        role="combobox"
        autocomplete="off"
        enterkeyhint="search"
        maxlength="100"
        :placeholder="t('nav.searchPlaceholder')"
        aria-autocomplete="list"
        :aria-expanded="expanded"
        :aria-controls="listboxId"
        :aria-activedescendant="activeId"
        data-testid="search-input"
        @input="onInput"
        @focus="reopen"
        @click="reopen"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.esc="onEscape"
      />
    </form>

    <ul
      v-show="expanded"
      :id="listboxId"
      class="search-box__menu"
      role="listbox"
      :aria-label="t('search.suggestions')"
      data-testid="search-suggestions"
    >
      <li
        v-for="(work, index) in items"
        :id="`${uid}-option-${index}`"
        :key="work.id"
        role="option"
        class="search-box__option"
        :class="{ 'search-box__option--active': index === activeIndex }"
        :aria-selected="index === activeIndex"
        @mouseenter="activeIndex = index"
        @click="navigateTo(workPath(work.id, work.title))"
      >
        <WorkCover :url="coverUrl(work.coverPath)" size="small" class="search-box__cover" />
        <span class="search-box__text">
          <span class="search-box__title">{{ work.title }}</span>
          <span class="search-box__meta">{{ formatWorkSummary(work) }}</span>
        </span>
      </li>
      <li
        :id="`${uid}-option-${items.length}`"
        role="option"
        class="search-box__option search-box__option--all"
        :class="{ 'search-box__option--active': activeIndex === items.length }"
        :aria-selected="activeIndex === items.length"
        data-testid="search-see-all"
        @mouseenter="activeIndex = items.length"
        @click="navigateTo(resultsPath())"
      >
        {{ t('search.seeAll', { count: total }, total) }}
        <Icon name="tabler:corner-down-left" size="14" aria-hidden="true" />
      </li>
    </ul>
    <output class="search-box__status" aria-live="polite">
      {{ expanded ? t('search.suggestionCount', items.length) : '' }}
    </output>
  </div>
</template>

<style scoped lang="scss">
.search-box {
  position: relative;
  min-width: 0;
}

.search-box__form {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box__icon {
  position: absolute;
  left: 12px;
  color: var(--color-ink-soft);
  pointer-events: none;
}

// Libellé réservé aux lecteurs d'écran ; le texte d'aide est le placeholder.
.search-box__label,
.search-box__status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

// 16 px au mobile : en dessous, Safari iOS zoome au focus.
.search-box__input {
  width: 100%;
  min-height: var(--touch);
  padding: 0 12px 0 34px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 1rem;

  @media (min-width: 768px) {
    min-height: 0;
    padding: 9px 12px 9px 34px;
    font-size: 0.9375rem;
  }
}

.search-box__input--open {
  border-radius: var(--radius) var(--radius) 0 0;
}

.search-box__menu {
  position: absolute;
  inset: calc(100% - 2px) 0 auto;
  z-index: 20;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: var(--border);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--color-surface);
}

.search-box__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;

  @media (min-width: 768px) {
    min-height: 0;
  }
}

.search-box__option + .search-box__option {
  border-top: 1px dashed var(--color-rule);
}

.search-box__option--active {
  background: var(--color-field-soft);
  box-shadow: inset 3px 0 0 var(--color-blue);
}

.search-box__option--all {
  justify-content: space-between;
  background: var(--color-field-soft);
  font-size: 0.875rem;
  font-weight: 800;
}

.search-box__option .search-box__cover {
  width: 40px;
}

.search-box__text {
  display: grid;
  min-width: 0;
}

.search-box__title {
  color: var(--color-blue);
  font-size: 1rem;
  font-weight: 800;
}

.search-box__meta {
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}
</style>
