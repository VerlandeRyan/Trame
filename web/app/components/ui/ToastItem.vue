<script setup lang="ts">
/**
 * One announcement of the toast stack: icon, message, optional "Retry" and close button, with a
 * countdown bar. It hides itself when the delay runs out, except while hovered or focused.
 */
import { autoDismissDelay, type Toast, type ToastTone } from '~/utils/toasts'

const props = defineProps<{ toast: Toast }>()
const emit = defineEmits<{ dismiss: []; retry: [] }>()
const { t } = useI18n()

const TONE_ICONS: Record<ToastTone, string> = {
  info: 'tabler:info-circle',
  success: 'tabler:circle-check',
  error: 'tabler:alert-circle',
}

const durationMs = autoDismissDelay(props.toast.tone)
const isHovered = ref(false)
const hasFocus = ref(false)
const isPaused = computed(() => isHovered.value || hasFocus.value)

let remainingMs = durationMs
let startedAt = 0
let timer: ReturnType<typeof setTimeout> | undefined

/** Starts (or restarts) the countdown with the time left. */
function startTimer() {
  startedAt = Date.now()
  timer = setTimeout(() => emit('dismiss'), remainingMs)
}

/** Stops the countdown and keeps the time left. */
function stopTimer() {
  if (timer === undefined) return
  clearTimeout(timer)
  timer = undefined
  remainingMs -= Date.now() - startedAt
}

// The timer only runs in the browser: a toast rendered on the server starts it once mounted.
onMounted(startTimer)
onBeforeUnmount(stopTimer)
watch(isPaused, (paused) => (paused ? stopTimer() : startTimer()))
</script>

<template>
  <div
    class="toast"
    :class="[`toast--${toast.tone}`, { 'toast--paused': isPaused }]"
    :role="toast.tone === 'error' ? 'alert' : 'status'"
    :style="{ '--toast-duration': `${durationMs}ms` }"
    data-testid="toast"
    @pointerenter="isHovered = $event.pointerType === 'mouse'"
    @pointerleave="isHovered = false"
    @focusin="hasFocus = true"
    @focusout="hasFocus = false"
  >
    <Icon :name="TONE_ICONS[toast.tone]" size="20" aria-hidden="true" />
    <p class="toast__text">
      {{ t(toast.messageKey) }}
      <span v-if="toast.hintKey" class="toast__hint">{{ t(toast.hintKey) }}</span>
    </p>
    <UiButton
      v-if="toast.retry"
      variant="secondary"
      size="small"
      data-testid="toast-retry"
      @click="emit('retry')"
    >
      {{ t('action.retry') }}
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

    // Countdown bar along the bottom edge: it empties as long as the toast stays.
    &::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 4px;
      background: currentcolor;
      opacity: 0.55;
      transform-origin: left;
      animation: toast-countdown var(--toast-duration) linear forwards;
    }

    &--paused::after {
      animation-play-state: paused;
    }
  }
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes toast-countdown {
  to {
    transform: scaleX(0);
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

// The hover is a veil of the text colour: readable on every tone, and nothing moves, so the
// cross stays aligned with the "Retry" button.
.toast__close {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: inherit;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 0.15s;
  }

  @include on-hover {
    background: color-mix(in srgb, currentcolor 25%, transparent);
  }

  &:active {
    background: color-mix(in srgb, currentcolor 25%, transparent);
  }
}
</style>
