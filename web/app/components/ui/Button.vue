<script setup lang="ts">
/** Button, or a link styled as a button, in several colour variants and two sizes. */
import type { RouteLocationRaw } from 'vue-router'

/** Hover tilt tier, chosen by button width. */
type Tilt = 'small' | 'medium' | 'wide'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'blue' | 'success' | 'danger' | 'danger-solid'
    size?: 'normal' | 'small'
    /** Status colour: work already in the list (the label is always present). */
    status?: 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'
    /** A link (full navigation) styled as a button. */
    href?: string
    /** An internal site link (navigation without reload) styled as a button. */
    to?: RouteLocationRaw
    /** Full width, less tilted on hover. */
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
// Hover tilt tier by width: `wide` for full width, `small` for the small size, otherwise
// `medium`. A very narrow button ("+1") overrides it with `tilt-on-hover` in its parent's style.
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

  @include press-down;

  // Without this, a disabled button looks active.
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Hover and press: tilt; white button → `--color-cover-empty`, coloured button → darker
// background, text untouched.
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

// Confirm (save): the 'reading' green, ink text (AA contrast).
.btn--success {
  background: var(--status-reading);

  @include tilt-on-hover(var(--status-reading-strong));
}

// Action destructrice : cadre et texte rouges sur fond blanc.
.btn--danger {
  border-color: var(--color-danger);
  background: var(--color-surface);
  color: var(--color-danger);

  // Hover stays red: pale pink background, red frame and text.
  @include tilt-on-hover(var(--color-chip));
}

// Destructive action confirmation: red background, white text (6.3:1).
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

// Statuses: their colour is data, so it is darkened.
@each $status in (reading, completed, plan_to_read, on_hold, dropped) {
  .btn--status-#{$status} {
    background: var(--status-#{$status});

    // The status background wins over the variant's hover.
    @include tilt-on-hover(var(--status-#{$status}-strong));
  }
}

// Tilt tier by width (see `_mixins.scss`). After the variants and statuses,
// to win over their current tier.
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
