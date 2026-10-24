<script setup lang="ts">
// Menu déroulant à cadre blanc, avec son nom de champ au-dessus comme `UiField`.
defineProps<{ options: { value: string; label: string }[]; label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="select-field">
    <span class="select-field__label">{{ label }}</span>
    <UiSelect v-model="model" boxed prefix="" :options="options" :label="label" />
  </div>
</template>

<style scoped lang="scss">
.select-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-1);

  :deep(.select) {
    display: flex;
  }
}

.select-field__label {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
