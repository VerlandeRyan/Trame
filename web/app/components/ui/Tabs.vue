<script setup lang="ts">
export interface UiTab {
  id: string
  label: string
  count?: number
  // Couleur de statut de lecture (code de library_entry.status).
  status?: 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'
  // Texte d'alerte : l'onglet porte un point rouge (erreur à corriger dans ce panneau).
  alert?: string
}

// `underline` : onglets de l'administration, texte souligné au lieu de pastilles.
const props = withDefaults(defineProps<{ tabs: UiTab[]; label: string; underline?: boolean }>(), {
  underline: false,
})
const activeTabId = defineModel<string>({ required: true })
const tabButtons = ref<HTMLButtonElement[]>([])
const tablist = ref<HTMLElement | null>(null)

// Chevrons des onglets soulignés : ils signalent les onglets cachés de part et d'autre.
const hasHiddenBefore = ref(false)
const hasHiddenAfter = ref(false)
// Part de la largeur visible parcourue par un clic sur un chevron.
const SCROLL_STEP_RATIO = 0.6

function updateHiddenTabs() {
  const element = tablist.value
  if (!element) return
  hasHiddenBefore.value = element.scrollLeft > 1
  hasHiddenAfter.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
}

function scrollTabs(direction: -1 | 1) {
  const element = tablist.value
  element?.scrollBy({ left: direction * element.clientWidth * SCROLL_STEP_RATIO })
}

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

// Index de l'onglet visé par une touche de navigation ; undefined si la touche n'en est pas une.
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

function onKeydown(event: KeyboardEvent, currentIndex: number) {
  const targetIndex = targetIndexFor(event.key, currentIndex)
  const targetTab = targetIndex === undefined ? undefined : props.tabs[targetIndex]
  if (targetIndex === undefined || !targetTab) return

  event.preventDefault()
  activeTabId.value = targetTab.id
  tabButtons.value[targetIndex]?.focus()
}

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

  // Jamais sur l'onglet courant : un survol ne doit pas ressembler à une sélection.
  &:not(.tabs__tab--active) {
    @include on-hover {
      background: var(--color-cover-empty);

      // La pastille de nombre, de la même teinte que ce fond, passe en blanc pour rester visible.
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

// Deux lignes superposées, comme la maquette : filet d'encre de la barre, trait bleu de l'onglet.
.tabs--underline {
  @include underline-tab-bar;

  gap: 0;

  .tabs__tab {
    // Le trait de l'onglet actif couvre l'onglet entier, pas seulement son texte.
    padding: 0 var(--space-4);

    @include underline-tab('tabs__tab--active');

    // Le fond reste celui du papier : la pastille garde sa teinte de repos.
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

  // Les chevrons remplacent la barre de défilement.
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

// Emplacement de largeur nulle collé au bord du défilement : le chevron reste visible tout en
// laissant les onglets défiler dessous.
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

// Chevron dans un cadre rond à contour rose, au-dessus du filet des onglets.
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
  fill: var(--color-danger);
}

.tabs__count {
  padding: 0 6px;
  border-radius: var(--radius);
  background: var(--color-cover-blank);
  color: var(--color-ink);
  font-size: 0.75rem;
}
</style>
