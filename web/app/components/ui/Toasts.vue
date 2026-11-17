<script setup lang="ts">
/** Stack of announcements fixed at the bottom of the screen (see `useToasts`). */
const { toasts, dismiss, retry } = useToasts()
</script>

<template>
  <div class="toasts" data-testid="toasts">
    <UiToastItem
      v-for="toast in toasts"
      :key="toast.id"
      :toast="toast"
      @dismiss="dismiss(toast.id)"
      @retry="retry(toast.id)"
    />
  </div>
</template>

<style scoped lang="scss">
// Above the page content and the sign-in modal backdrop; clicks pass through the gaps.
.toasts {
  position: fixed;
  right: var(--space-3);
  bottom: var(--space-3);
  left: var(--space-3);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;

  @media (min-width: 768px) {
    left: auto;
    width: 540px;
  }
}
</style>
