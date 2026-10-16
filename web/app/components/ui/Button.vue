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
@use '~/assets/styles/mixins' as *;

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

  // Seul retour au doigt ; l'emporte sur l'inclinaison du survol.
  &:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--color-ink);
  }

  // Sans cela un bouton inactif a l'air actif.
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Survol : inclinaison et fond plus soutenu de la couleur d'origine.
.btn--primary {
  background: var(--color-rose);

  @include tilt-on-hover(var(--color-rose-strong));
}

.btn--secondary {
  background: var(--color-surface);

  @include tilt-on-hover(var(--color-cover-empty));
}

.btn--blue {
  background: var(--color-blue);
  color: #fff;

  @include tilt-on-hover(var(--color-blue-strong));
}

.btn--small {
  padding: 0 14px;
  box-shadow: var(--shadow-small);
  font-size: 0.8125rem;
  font-weight: 800;

  &:active:not(:disabled) {
    box-shadow: none;
  }
}

// Statuts : leur couleur est une donnée, on l'assombrit.
@each $status in (reading, completed, plan_to_read, on_hold, dropped) {
  .btn--status-#{$status} {
    background: var(--status-#{$status});

    // Le fond du statut l'emporte sur le survol de la variante.
    @include tilt-on-hover(var(--status-#{$status}));
    @include on-hover {
      filter: brightness(0.92);
    }
  }
}
</style>
