<script setup lang="ts">
// Choix en pastilles : un seul (radios natifs) ou plusieurs (cases natives). Le contrôle natif reste
// dans le DOM, au clavier et pour les lecteurs d'écran, mais n'est pas dessiné ; la pastille choisie
// prend l'encre, le survol (souris seulement) l'éclaircit.
const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  multiple?: boolean
}>()
const model = defineModel<string | string[]>({ required: true })
const uid = useId()

const isChosen = (value: string) =>
  Array.isArray(model.value) ? model.value.includes(value) : model.value === value

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

  @include on-hover {
    background: var(--color-cover-empty);
  }

  &:has(input:checked) {
    background: var(--color-ink);
    color: var(--color-surface);

    @include on-hover {
      background: var(--color-blue-strong);
    }
  }

  &:has(input:focus-visible) {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }
}
</style>
