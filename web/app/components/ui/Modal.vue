<script setup lang="ts">
// Modale simple basée sur <dialog> natif (focus, Échap, inertie du fond gérés par le navigateur).
// Les cas complexes (combobox, menus) passeront par des primitives headless, plus tard.
defineProps<{ title: string; closeLabel: string }>()
const open = defineModel<boolean>({ default: false })
const dialog = ref<HTMLDialogElement | null>(null)

// Le <dialog> existe dès le montage : ce watcher ne s'exécute qu'ensuite.
watch(open, (isOpen) => {
  const dialogElement = dialog.value as HTMLDialogElement
  if (isOpen && !dialogElement.open) dialogElement.showModal()
  if (!isOpen && dialogElement.open) dialogElement.close()
})
</script>

<template>
  <dialog ref="dialog" class="modal" @close="open = false">
    <header class="modal__head">
      <h2 class="modal__title">{{ title }}</h2>
      <button type="button" class="modal__close" :aria-label="closeLabel" @click="open = false">
        <Icon name="tabler:x" size="20" aria-hidden="true" />
      </button>
    </header>
    <div class="modal__body"><slot /></div>
  </dialog>
</template>

<style scoped lang="scss">
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

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border);
}

.modal__title {
  font-size: 1.125rem;
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
</style>
