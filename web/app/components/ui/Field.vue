<script setup lang="ts">
// `prefix` (ex. « @ ») précède la saisie ; `error` remplace l'aide ; `inputAttributes` complète l'`<input>`.
const props = defineProps<{
  label: string
  id: string
  hint?: string
  prefix?: string
  error?: string
  inputAttributes?: { maxlength?: number; autocomplete?: string }
}>()
const model = defineModel<string>({ default: '' })

const describedBy = computed(() => {
  if (props.error) return `${props.id}-error`
  return props.hint ? `${props.id}-hint` : undefined
})
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label :for="id" class="field__label">{{ label }}</label>
    <div class="field__box">
      <span v-if="prefix" class="field__prefix" aria-hidden="true">{{ prefix }}</span>
      <input
        :id="id"
        v-model="model"
        class="field__input"
        v-bind="inputAttributes"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
    </div>
    <p v-if="error" :id="`${id}-error`" class="field__error" role="alert">
      <Icon name="tabler:alert-circle" size="16" aria-hidden="true" />{{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
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

.field__box {
  display: flex;
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  &:focus-within {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }
}

.field--error .field__box {
  border-color: var(--color-crimson);
}

.field__prefix {
  margin-right: var(--space-1);
  color: var(--color-ink-soft);
  font-size: 1rem;
}

.field__input {
  flex: 1;
  min-width: 0;
  min-height: calc(var(--touch) - 6px);
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  // 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
  font-size: 1rem;

  &:focus {
    outline: none;
  }
}

.field__hint {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.field__error {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  margin: 0;
  color: var(--color-crimson);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
