<script setup lang="ts">
import { LIBRARY_STATUSES, type LibraryStatus } from '~/utils/library'
import { shouldOpenAbove } from '~/utils/menu'

// Menu des cinq statuts de lecture, partagé par la fiche œuvre et Ma liste. L'appelant fournit le
// déclencheur (slot `trigger`) et, au besoin, une action de pied (slot `footer`).
const props = defineProps<{
  status: LibraryStatus
  /** Préfixe des `data-testid` des lignes : `<préfixe>-<statut>`. */
  testidPrefix: string
  /** Le menu prend toute la largeur de l'appelant au lieu de celle de son déclencheur. */
  block?: boolean
}>()
const emit = defineEmits<{ change: [status: LibraryStatus] }>()
const slots = useSlots()
const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const findTrigger = () => root.value?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null
const { isOpen, close } = useDismissableMenu(root, () => findTrigger()?.focus())
const menuId = useId()

const ROW_HEIGHT = 44
// Retrait du cadre autour des lignes.
const PANEL_PADDING = 16
// Ligne du pied : une ligne tactile et son trait de séparation.
const FOOTER_HEIGHT = ROW_HEIGHT + 1
// Près du bas de l'écran, le menu s'ouvre au-dessus du déclencheur au lieu d'être coupé.
const opensAbove = ref(false)

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

  .status-list--block > & {
    right: 0;
  }
}

.status-list__panel--above {
  top: auto;
  bottom: calc(100% + var(--space-1));
}

// Style unique des menus de choix : lignes pleine largeur séparées d'un pointillé, choix courant
// en bleu plein avec la coche à gauche. Le pied reçoit les mêmes lignes par `:deep`.
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

  // Le survol et l'appui ne changent pas le choix courant (bleu plein).
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

// Texte rouge : survol rose pâle, comme « Archiver » (conventions § survol et appui).
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

// Trait plein : l'action du pied se détache des statuts.
.status-list__footer {
  border-top: var(--border);
  border-top-color: var(--color-blue);
}
</style>
