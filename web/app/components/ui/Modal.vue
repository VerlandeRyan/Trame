<script setup lang="ts">
// Modale basée sur <dialog> natif (focus, Échap, inertie du fond gérés par le navigateur).
// `placement="bottom"` : feuille basse, le slot `footer` reste visible sous le contenu défilant.
// `plain` : fenêtre d'invitation, sans filet sous le titre.
withDefaults(
  defineProps<{
    title: string
    closeLabel: string
    placement?: 'center' | 'bottom'
    plain?: boolean
    // Action destructrice : titre rouge.
    danger?: boolean
  }>(),
  { placement: 'center', plain: false, danger: false },
)
const open = defineModel<boolean>({ default: false })
const dialog = ref<HTMLDialogElement | null>(null)

// Le <dialog> ne reçoit un clic que sur son `::backdrop` : son contenu occupe toute la boîte.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}

// Le <dialog> existe dès le montage : ce watcher ne s'exécute qu'ensuite.
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

// Déclaré après `modal--bottom` : à spécificité égale, ces règles l'emportent.
.modal--plain {
  // `--modal-width` : une fenêtre plus riche (formulaire) élargit la fenêtre d'invitation.
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

  // Croix de 28 px dans le coin, zone tactile de 44 px (`::after`).
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

    // Même mouvement que les flèches du carrousel.
    @media (prefers-reduced-motion: no-preference) {
      transition:
        transform 0.12s ease-out,
        box-shadow 0.12s ease-out,
        background-color 0.15s;
    }

    @include on-hover {
      background: var(--color-rose);

      @media (prefers-reduced-motion: no-preference) {
        box-shadow: var(--shadow-small);
        transform: translate(-1px, -1px);
      }
    }

    &:active {
      background: var(--color-rose);
      box-shadow: none;
      transform: translate(1px, 1px);
    }
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

<!-- Non scopé : la règle vise <html>. Safari iOS ignore `overscroll-behavior` sur certains défilements. -->
<style lang="scss">
html:has(dialog.modal--bottom[open]) {
  overflow: hidden;
}
</style>
