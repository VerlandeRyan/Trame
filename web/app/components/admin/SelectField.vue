<script setup lang="ts">
/** White-framed dropdown with its field name above, like `UiField`. */
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
  font-weight: 700;
}
</style>
