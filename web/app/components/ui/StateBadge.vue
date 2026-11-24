<!-- Pill that names the state of a record once it has left the drafts: published (green) or archived (pink). -->
<script setup lang="ts">
/** Chip of a published (green) or archived (pink) record; the text is the slot. */
defineProps<{ state: 'published' | 'archived' }>()
</script>

<template>
  <span class="state-badge" :class="`state-badge--${state}`"><slot /></span>
</template>

<style scoped lang="scss">
.state-badge {
  display: inline-block;
  padding: 1px 9px;
  border: var(--border);
  border-radius: var(--radius);
  font-size: 0.75rem;
  font-weight: 800;
}

.state-badge--published {
  background: var(--status-reading);
}

.state-badge--archived {
  background: var(--color-chip);
}
</style>
