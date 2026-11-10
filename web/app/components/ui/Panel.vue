<!-- White panel with an outline and an ink shadow: generic container of content blocks. -->
<template>
  <div class="panel"><slot /></div>
</template>

<style scoped lang="scss">
// White panel with an outline and an ink shadow: generic container of content blocks.
.panel {
  padding: 14px 16px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}
</style>
