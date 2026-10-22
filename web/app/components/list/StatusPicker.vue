<script setup lang="ts">
import { LIBRARY_STATUSES, type LibraryStatus } from '~/utils/library'
import { shouldOpenAbove } from '~/utils/menu'

// Statut d'une œuvre de la liste : bouton à sa couleur qui ouvre le menu des cinq statuts.
const props = defineProps<{ status: LibraryStatus; title: string }>()
const emit = defineEmits<{ change: [status: LibraryStatus] }>()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.$el.focus())
const menuId = useId()

// Hauteur du menu : une ligne tactile par statut, plus le retrait du cadre.
const MENU_HEIGHT = LIBRARY_STATUSES.length * 44 + 16
// Près du bas de l'écran, le menu s'ouvre au-dessus du bouton au lieu d'être coupé.
const opensAbove = ref(false)

function toggleMenu() {
  if (!isOpen.value && trigger.value) {
    const rect = trigger.value.$el.getBoundingClientRect()
    opensAbove.value = shouldOpenAbove(rect, window.innerHeight, MENU_HEIGHT)
  }
  isOpen.value = !isOpen.value
}

function choose(status: LibraryStatus) {
  close({ restoreFocus: true })
  if (status !== props.status) emit('change', status)
}
</script>

<template>
  <div ref="root" class="status-picker">
    <UiButton
      ref="trigger"
      size="small"
      :status="status"
      class="status-picker__trigger"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      :aria-label="t('list.changeStatus', { title })"
      data-testid="list-status"
      @click="toggleMenu"
    >
      {{ t(`readingStatus.${status}`) }}
      <Icon name="tabler:chevron-down" size="14" aria-hidden="true" />
    </UiButton>
    <div
      v-show="isOpen"
      :id="menuId"
      class="status-picker__panel"
      :class="{ 'status-picker__panel--above': opensAbove }"
      role="menu"
    >
      <button
        v-for="candidate in LIBRARY_STATUSES"
        :key="candidate"
        type="button"
        class="status-picker__item"
        role="menuitemradio"
        :aria-checked="candidate === status"
        :data-testid="`list-status-${candidate}`"
        @click="choose(candidate)"
      >
        <span
          class="status-picker__dot"
          :style="{ background: `var(--status-${candidate})` }"
          aria-hidden="true"
        />
        {{ t(`readingStatus.${candidate}`) }}
        <Icon
          v-if="candidate === status"
          name="tabler:check"
          size="16"
          aria-hidden="true"
          class="status-picker__check"
        />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.status-picker {
  position: relative;
  display: inline-block;
}

.status-picker__trigger {
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}

.status-picker__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 20;
  min-width: 10rem;
  padding: var(--space-1);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.status-picker__panel--above {
  top: auto;
  bottom: calc(100% + var(--space-1));
}

.status-picker__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;

  @include on-hover {
    background: var(--color-field-soft);
  }
}

.status-picker__dot {
  flex: none;
  width: 14px;
  height: 14px;
  border: var(--border);
  border-radius: 50%;
}

.status-picker__check {
  margin-left: auto;
}
</style>
