<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'blue' | 'success' | 'danger' | 'danger-solid'
    size?: 'normal' | 'small'
    // Couleur de statut : œuvre déjà dans la liste (le libellé reste toujours présent).
    status?: 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'
    // Un lien (navigation complète) à l'aspect d'un bouton.
    href?: string
    // Un lien interne du site (navigation sans rechargement) à l'aspect d'un bouton.
    to?: RouteLocationRaw
    // Pleine largeur, survol moins incliné.
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'normal',
    status: undefined,
    href: undefined,
    to: undefined,
    block: false,
  },
)
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <component
    :is="href ? 'a' : to ? NuxtLink : 'button'"
    :type="href || to ? undefined : 'button'"
    :href="href"
    :to="to"
    class="btn"
    :class="[
      `btn--${variant}`,
      `btn--${size}`,
      status && `btn--status-${status}`,
      block && 'btn--block',
    ]"
  >
    <slot />
  </component>
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
  text-decoration: none;
  cursor: pointer;

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
  color: var(--color-surface);

  @include tilt-on-hover(var(--color-blue-strong));
}

// Valider (enregistrer) : le vert de « En cours », texte d'encre (contraste AA).
.btn--success {
  background: var(--status-reading);

  @include tilt-on-hover(var(--status-reading));
  @include on-hover {
    filter: brightness(0.92);
  }
}

// Action destructrice : cadre et texte rouges sur fond blanc.
.btn--danger {
  border-color: var(--color-danger);
  background: var(--color-surface);
  color: var(--color-danger);

  @include tilt-on-hover(var(--color-chip));
}

// Confirmation d'une action destructrice : fond rouge, texte blanc (6,3:1).
.btn--danger-solid {
  background: var(--color-danger);
  color: var(--color-surface);

  @include tilt-on-hover(var(--color-danger));
  @include on-hover {
    filter: brightness(0.9);
  }
}

.btn--small {
  padding: 0 14px;
  box-shadow: var(--shadow-small);
  font-size: 0.8125rem;
  font-weight: 800;
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

// Pleine largeur : une inclinaison de −2,5° ferait déborder les coins sur les éléments voisins.
.btn--block {
  display: flex;
  width: 100%;

  @include tilt-on-hover(null, 1.015, -0.6deg);
}

// Appui (seul retour au doigt) : déclaré en dernier pour l'emporter sur l'inclinaison du survol,
// de même spécificité.
.btn:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--color-ink);
}

.btn--small:active:not(:disabled) {
  box-shadow: none;
}
</style>
