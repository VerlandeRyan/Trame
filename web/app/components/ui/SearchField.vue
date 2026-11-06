<script setup lang="ts">
// Champ de recherche à loupe. `class` et `style` vont au cadre (l'appelant le place) ; les autres
// attributs natifs (`placeholder`, `maxlength`, `data-testid`, écouteurs…) vont au champ. `label` est le nom accessible, masqué ; sans lui, l'appelant relie son
// propre libellé visible par `id`. `small` : champ bas au bureau (filtres de la page Recherche).
import type { StyleValue } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ label?: string; small?: boolean }>()
const attrs = useAttrs()
const inputAttributes = computed(() => {
  const native = { ...attrs }
  delete native.class
  delete native.style
  return native
})
const model = defineModel<string>({ default: '' })
// Émis après la mise à jour du modèle : le parent y lit déjà la valeur à jour.
const emit = defineEmits<{ input: [event: Event] }>()

const box = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)

function onInput(event: Event) {
  model.value = (event.target as HTMLInputElement).value
  emit('input', event)
}

defineExpose({
  focus: () => input.value?.focus(),
  // Le cadre, pas le champ : une liste de propositions se place sous le contour.
  getBoundingClientRect: () => box.value!.getBoundingClientRect(),
})
</script>

<template>
  <div
    ref="box"
    class="search"
    :class="[{ 'search--small': small }, attrs.class]"
    :style="attrs.style as StyleValue"
  >
    <Icon name="tabler:search" aria-hidden="true" class="search__icon" />
    <input
      ref="input"
      v-bind="inputAttributes"
      :value="model"
      type="search"
      class="search__input"
      :aria-label="label"
      @input="onInput"
    />
  </div>
</template>

<style scoped lang="scss">
.search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  &:focus-within {
    outline: 3px solid var(--color-ink);
    outline-offset: 2px;
  }

  // Champ bas au bureau ; au doigt il garde la zone tactile entière.
  &--small {
    @media (min-width: 768px) {
      min-height: 0;
      padding: 0 var(--space-2);
    }
  }
}

.search__icon {
  flex: none;
  color: var(--color-ink-soft);
  font-size: 20px;

  .search--small & {
    @media (min-width: 768px) {
      font-size: 14px;
    }
  }
}

.search__input {
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

  .search--small & {
    @media (min-width: 768px) {
      min-height: 0;
      padding: 4px 0;
      font-size: 0.8125rem;
    }
  }
}
</style>
