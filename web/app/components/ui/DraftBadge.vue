<!-- Yellow pill that marks a draft: a record not yet published, work still to do. -->
<template>
  <span class="draft-badge"><slot /></span>
</template>

<style scoped lang="scss">
.draft-badge {
  display: inline-block;
  padding: 1px 9px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--status-on_hold);
  font-size: 0.75rem;
  font-weight: 800;
}
</style>
