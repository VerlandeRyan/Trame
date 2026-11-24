<script setup lang="ts">
/**
 * Search field with a magnifier. `class` and `style` go to the frame (the caller places it); the
 * other native attributes (placeholder, maxlength, test id, listeners…) go to the input. `label`
 * is the hidden accessible name; without it, the caller links its own visible label by `id`.
 * `small`: low field on desktop (filters of the search page). A cross empties the filled field
 * through a native `input` event, so callers react as to a keystroke.
 */
import type { StyleValue } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ label?: string; small?: boolean }>()
const attrs = useAttrs()
const { t } = useI18n()
/** Native attributes for the input (everything but class and style). */
const inputAttributes = computed(() => {
  const native = { ...attrs }
  delete native.class
  delete native.style
  return native
})
const model = defineModel<string>({ default: '' })
// Emitted after the model update: the parent already reads the up-to-date value.
const emit = defineEmits<{ input: [event: Event] }>()

const box = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)

/** Updates the model, then reports the input event. */
function onInput(event: Event) {
  model.value = (event.target as HTMLInputElement).value
  emit('input', event)
}

/** Empties the field through a native `input` event, so every listener reacts as to a keystroke. */
function clear() {
  const field = input.value
  if (!field) return
  field.value = ''
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.focus()
}

defineExpose({
  focus: () => input.value?.focus(),
  // The frame, not the input: a suggestion list is placed under the outline.
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
    <button
      v-if="model !== ''"
      type="button"
      class="search__clear"
      :aria-label="t('action.clearField')"
      data-testid="search-clear"
      @click="clear"
    >
      <Icon name="tabler:x" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

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

  // Low field on desktop; with a finger it keeps the full touch area.
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

// The cross is ours: the browser's own one cannot be styled like the other crosses.
.search__clear {
  @include frame-dismiss-button;

  font-size: 16px;

  .search--small & {
    @media (min-width: 768px) {
      width: 20px;
      height: 20px;
      margin-right: -6px;
      font-size: 14px;
    }
  }
}

.search__input::-webkit-search-cancel-button {
  display: none;
}

.search__input {
  flex: 1;
  min-width: 0;
  min-height: calc(var(--touch) - 6px);
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  // 16 px minimum: avoids Safari iOS's automatic zoom on focus.
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
