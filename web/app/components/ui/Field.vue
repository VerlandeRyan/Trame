<script setup lang="ts">
defineProps<{ label: string; id: string; hint?: string }>()
const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      class="field__input"
      :aria-describedby="hint ? `${id}-hint` : undefined"
    />
    <p v-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.field {
  display: grid;
  gap: var(--space-1);
}

.field__label {
  font-weight: 700;
}

.field__input {
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  // 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
  font-size: 1rem;
}

.field__hint {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
