<script setup lang="ts">
/**
 * Choice in pills: one (native radios) or several (native checkboxes). The native control stays
 * in the DOM, for the keyboard and screen readers, but is not drawn; the chosen pill takes the
 * ink colour, and hover (mouse only) lightens it.
 */
const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  multiple?: boolean
}>()
const model = defineModel<string | string[]>({ required: true })
const uid = useId()

/** Whether the value is currently chosen. */
const isChosen = (value: string) =>
  Array.isArray(model.value) ? model.value.includes(value) : model.value === value

/** Chooses the value, or toggles it in multiple mode. */
function choose(value: string) {
  if (!props.multiple || !Array.isArray(model.value)) {
    model.value = value
    return
  }
  model.value = model.value.includes(value)
    ? model.value.filter((chosen) => chosen !== value)
    : [...model.value, value]
}
</script>

<template>
  <fieldset class="pills">
    <legend class="pills__legend">{{ label }}</legend>
    <label v-for="option in options" :key="option.value" class="pills__pill">
      <input
        :type="multiple ? 'checkbox' : 'radio'"
        :name="uid"
        :checked="isChosen(option.value)"
        :data-testid="`pill-${option.value}`"
        @change="choose(option.value)"
      />
      {{ option.label }}
    </label>
  </fieldset>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.pills__legend {
  width: 100%;
  margin-bottom: var(--space-1);
  padding: 0;
  font-weight: 700;
}

.pills__pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  font-weight: 700;
  cursor: pointer;

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  // Hover does not change a checked pill.
  &:not(:has(input:checked)) {
    @include on-hover {
      background: var(--color-cover-empty);
    }
  }

  &:has(input:checked) {
    background: var(--color-ink);
    color: var(--color-surface);
  }

  &:has(input:focus-visible) {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }
}
</style>
