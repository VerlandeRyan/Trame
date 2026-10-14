<template>
  <span class="chip"><slot /></span>
</template>

<style scoped lang="scss">
.chip {
  display: inline-block;
  padding: 1px 9px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-chip);
  font-size: 0.6875rem;
  font-weight: 700;
}
</style>
