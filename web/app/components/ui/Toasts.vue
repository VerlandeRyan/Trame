<script setup lang="ts">
/**
 * Stack of announcements fixed at the bottom of the screen (see `useToasts`). Its live region is
 * always in the page, so a toast added to it is read out (an inserted live region may not be).
 */
const { toasts, dismiss, dismissActionable, runAction } = useToasts()

// A "Retry" or "Undo" acts on the page that showed it: it must not outlive that page. A router
// hook, not a watch on the reactive route: that one updates after `navigateTo` resolves, which
// would close a toast shown right after leaving the page (an archiving made on the form).
const removeGuard = useRouter().afterEach((to, from) => {
  if (to.path !== from.path) dismissActionable()
})
onBeforeUnmount(removeGuard)
</script>

<template>
  <div class="toasts" aria-live="polite" data-testid="toasts">
    <UiToastItem
      v-for="toast in toasts"
      :key="toast.id"
      :toast="toast"
      @dismiss="dismiss(toast.id)"
      @action="runAction(toast.id)"
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
