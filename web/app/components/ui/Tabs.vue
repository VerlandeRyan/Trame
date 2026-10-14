<script setup lang="ts">
export interface UiTab {
  id: string
  label: string
  count?: number
  // Couleur de statut de lecture (code de library_entry.status).
  status?: 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'
}

const props = defineProps<{ tabs: UiTab[]; label: string }>()
const activeTabId = defineModel<string>({ required: true })
const tabButtons = ref<HTMLButtonElement[]>([])

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
  <div class="tabs" role="tablist" :aria-label="label">
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
    </button>
  </div>
</template>

<style scoped lang="scss">
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
}

.tabs__tab--active {
  background: var(--color-ink);
  color: #fff;
}

.tabs__status-dot {
  width: 10px;
  height: 10px;
  border: 1px solid var(--color-ink);
  border-radius: 50%;
}

.tabs__count {
  padding: 0 6px;
  border-radius: var(--radius);
  background: var(--color-field);
  color: var(--color-ink);
  font-size: 0.75rem;
}
</style>
