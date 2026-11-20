<script setup lang="ts">
/**
 * One announcement of the toast stack: icon, message, optional "Retry" or "Undo" button and close
 * button, with a countdown bar. It hides itself when the delay runs out, except while hovered or
 * focused; a lasting one (see `toastDismissDelay`) has no countdown bar. Only an
 * error has a role (`alert`): information and success are read through the live region of `UiToasts`.
 */
import { toastDismissDelay, type Toast, type ToastTone } from '~/utils/toasts'

const props = defineProps<{ toast: Toast }>()
const emit = defineEmits<{ dismiss: []; action: [] }>()
const { t } = useI18n()

const TONE_ICONS: Record<ToastTone, string> = {
  info: 'tabler:info-circle',
  success: 'tabler:circle-check',
  error: 'tabler:alert-circle',
}

const durationMs = toastDismissDelay(props.toast)
const { isPaused, pauseListeners } = useAutoDismiss(durationMs, () => emit('dismiss'))
</script>

<template>
  <div
    class="toast"
    :class="[
      `toast--${toast.tone}`,
      { 'toast--paused': isPaused, 'toast--lasting': durationMs === null },
    ]"
    :role="toast.tone === 'error' ? 'alert' : undefined"
    :style="{ '--dismiss-duration': `${durationMs ?? 0}ms` }"
    data-testid="toast"
    v-on="pauseListeners"
  >
    <Icon :name="TONE_ICONS[toast.tone]" size="20" aria-hidden="true" />
    <p class="toast__text">
      {{ t(toast.messageKey) }}
      <span v-if="toast.hintKey" class="toast__hint">{{ t(toast.hintKey) }}</span>
    </p>
    <UiButton
      v-if="toast.action"
      variant="secondary"
      size="small"
      class="toast__action"
      :data-testid="`toast-${toast.action.kind}`"
      @click="emit('action')"
    >
      {{ t(`action.${toast.action.kind}`) }}
    </UiButton>
    <button
      type="button"
      class="toast__close"
      :aria-label="t('action.close')"
      @click="emit('dismiss')"
    >
      <Icon name="tabler:x" size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// `overflow: hidden` keeps the countdown bar inside the rounded corners.
.toast {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-weight: 700;
  pointer-events: auto;

  @media (prefers-reduced-motion: no-preference) {
    animation: toast-in 0.15s ease-out;
  }

  @include countdown-bar('toast--paused');
}

// A toast that never hides itself has no countdown to show.
.toast--lasting::after {
  display: none;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.toast--info {
  background: var(--color-yellow);
}

// Status "reading" green: ink text, AA contrast.
.toast--success {
  background: var(--status-reading);
}

// White on `crimson`: at least 4.5:1 (checked by `contrast.spec.ts`).
.toast--error {
  background: var(--color-crimson);
  color: var(--color-surface);
}

.toast__text {
  flex: 1;
  margin: 0;
}

// The advice sits on its own line on wide screens and is dropped on a phone, where the
// message and the "Retry" button already say it.
.toast__hint {
  display: none;

  @media (min-width: 768px) {
    display: block;
  }
}

// Finger: the button reaches the touch size, as the close cross does.
.toast__action {
  @media (pointer: coarse) {
    min-height: var(--touch);
  }
}

.toast__close {
  @include dismiss-button;
}
</style>
