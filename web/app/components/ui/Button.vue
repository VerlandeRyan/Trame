<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'blue'
    size?: 'normal' | 'small'
    // Couleur de statut : bouton principal d'une œuvre déjà dans la liste (libellé toujours présent).
    status?: 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'
  }>(),
  { variant: 'primary', size: 'normal', status: undefined },
)
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, status && `btn--status-${status}`]"
  >
    <slot />
  </button>
</template>

<style scoped lang="scss">
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.08s;

  &:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--color-ink);
  }
}

.btn--primary {
  background: var(--color-rose);
}

.btn--secondary {
  background: var(--color-surface);
}

.btn--blue {
  background: var(--color-blue);
  color: #fff;
}

.btn--small {
  padding: 0 14px;
  box-shadow: var(--shadow-small);
  font-size: 0.8125rem;
  font-weight: 800;

  &:active {
    box-shadow: none;
  }
}

@each $status in (reading, completed, plan_to_read, on_hold, dropped) {
  .btn--status-#{$status} {
    background: var(--status-#{$status});
  }
}
</style>
