<script setup lang="ts">
/**
 * Modal built on the native dialog (focus, Escape and inert background handled by the browser).
 * `placement="bottom"`: bottom sheet, the `footer` slot stays visible under the scrolling content.
 * `plain`: invitation window, without a rule under the title.
 */
withDefaults(
  defineProps<{
    title: string
    closeLabel: string
    placement?: 'center' | 'bottom'
    plain?: boolean
    /** Destructive action: red title. */
    danger?: boolean
  }>(),
  { placement: 'center', plain: false, danger: false },
)
const open = defineModel<boolean>({ default: false })
const dialog = ref<HTMLDialogElement | null>(null)

/** Closes the modal on a click on the backdrop: the dialog only receives such a click there, since its content fills the box. */
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}

// The dialog exists from mounting on: this watcher only runs afterwards.
watch(open, (isOpen) => {
  const dialogElement = dialog.value as HTMLDialogElement
  if (isOpen && !dialogElement.open) dialogElement.showModal()
  if (!isOpen && dialogElement.open) dialogElement.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="[`modal--${placement}`, plain && 'modal--plain', danger && 'modal--danger']"
    @close="open = false"
    @click="onDialogClick"
  >
    <header class="modal__head">
      <h2 class="modal__title">{{ title }}</h2>
      <div v-if="$slots.actions" class="modal__actions"><slot name="actions" /></div>
      <button type="button" class="modal__close" :aria-label="closeLabel" @click="open = false">
        <Icon name="tabler:x" size="20" aria-hidden="true" />
      </button>
    </header>
    <div class="modal__body"><slot /></div>
    <footer v-if="$slots.footer" class="modal__footer"><slot name="footer" /></footer>
  </dialog>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.modal {
  width: min(480px, calc(100vw - 2 * var(--space-4)));
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
  color: var(--color-ink);

  &::backdrop {
    background: rgb(27 42 92 / 60%);
  }
}

.modal--bottom {
  width: 100%;
  max-width: none;
  max-height: 85dvh;
  margin: auto 0 0;
  border-width: 3px 0 0;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 0 var(--color-ink);

  &[open] {
    display: flex;
    flex-direction: column;
  }

  &::backdrop {
    background: rgb(27 42 92 / 40%);
  }

  .modal__title {
    color: var(--color-ink);
  }

  .modal__head {
    border-bottom: 0;
  }

  .modal__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-top: 0;
    overscroll-behavior: contain;
  }
}

// Declared after `modal--bottom`: at equal specificity, these rules win.
.modal--plain {
  // `--modal-width`: a richer window (form) widens the invitation window.
  &.modal--center {
    width: min(var(--modal-width, 440px), calc(100vw - 2 * var(--space-4)));
  }

  .modal__head {
    padding: 22px 24px 0;
    border-bottom: 0;
  }

  .modal__title {
    padding-right: 40px;
    color: var(--color-blue);
    font-size: 1.25rem;
    font-weight: 800;
  }

  // 28 px cross in the corner, 44 px touch area (`::after`).
  .modal__close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: var(--border);
    border-radius: var(--radius);
    background: var(--color-surface);

    &::after {
      content: '';
      position: absolute;
      inset: -8px;
    }

    @include lift-on-hover;
  }

  .modal__body {
    padding: 8px 24px 22px;
  }
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border);
}

.modal__title {
  margin-right: auto;
  font-size: 1.125rem;
}

.modal--danger .modal__title {
  color: var(--color-danger);
}

.modal__actions {
  display: flex;
  align-items: center;
}

.modal__close {
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: 0;
  background: none;
  cursor: pointer;
}

.modal__body {
  padding: var(--space-4);
}

.modal__footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px dashed var(--color-rule);
}
</style>

<!-- Not scoped: the rule targets <html>. Safari iOS ignores `overscroll-behavior` on some scrolling. -->
<style lang="scss">
html:has(dialog.modal--bottom[open]) {
  overflow: hidden;
}
</style>
