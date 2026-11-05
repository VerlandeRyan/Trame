<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

type Tilt = 'small' | 'medium' | 'wide'

const props = withDefaults(
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
// Palier d'inclinaison au survol (`_mixins.scss`) selon la largeur : `wide` en pleine largeur,
// `small` pour la petite taille, sinon `medium`. Un bouton très étroit (« +1 ») le surcharge
// avec `tilt-on-hover` dans le style de son parent.
const tiltTier = computed<Tilt>(() => {
  if (props.block) return 'wide'
  return props.size === 'small' ? 'small' : 'medium'
})
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
      `btn--tilt-${tiltTier}`,
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

  // Appui (souris et doigt, même fond que le survol).
  @include press-down;

  // Sans cela un bouton inactif a l'air actif.
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Survol et appui : inclinaison ; bouton blanc → `--color-cover-empty`, bouton coloré → fond plus
// foncé, texte intact.
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

  @include tilt-on-hover(var(--status-reading-strong));
}

// Action destructrice : cadre et texte rouges sur fond blanc.
.btn--danger {
  border-color: var(--color-danger);
  background: var(--color-surface);
  color: var(--color-danger);

  // Le survol reste rouge : fond rose pâle, cadre et texte rouges.
  @include tilt-on-hover(var(--color-chip));
}

// Confirmation d'une action destructrice : fond rouge, texte blanc (6,3:1).
.btn--danger-solid {
  background: var(--color-danger);
  color: var(--color-surface);

  @include tilt-on-hover(var(--color-danger-strong));
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
    @include tilt-on-hover(var(--status-#{$status}-strong));
  }
}

// Palier d'inclinaison selon la largeur (voir `_mixins.scss`). Après les variantes et les statuts,
// pour l'emporter sur leur palier courant.
@each $tier in (small, medium, wide) {
  .btn--tilt-#{$tier} {
    @include tilt-on-hover(null, $tier);
  }
}

.btn--block {
  display: flex;
  width: 100%;
}

.btn--small:active:not(:disabled) {
  box-shadow: none;
}
</style>
