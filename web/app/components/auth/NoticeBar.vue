<script setup lang="ts">
/**
 * Sign-in banner: message and close cross, with a countdown bar. It hides itself when the delay
 * of its tone runs out, except while hovered or focused (same delays as the toasts).
 */
import type { AuthNotice } from '~/utils/auth'
import { autoDismissDelay } from '~/utils/toasts'

const props = defineProps<{ notice: AuthNotice }>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const durationMs = autoDismissDelay(props.notice.tone)
const { isPaused, pauseListeners } = useAutoDismiss(durationMs, () => emit('dismiss'))
</script>

<template>
  <div
    class="auth-notice"
    :class="[`auth-notice--${notice.tone}`, { 'auth-notice--paused': isPaused }]"
    :style="{ '--dismiss-duration': `${durationMs}ms` }"
    role="alert"
    data-testid="auth-notice"
    v-on="pauseListeners"
  >
    <p class="auth-notice__text">{{ t(notice.key) }}</p>
    <button
      type="button"
      class="auth-notice__close"
      :aria-label="t('action.close')"
      @click="emit('dismiss')"
    >
      <Icon name="tabler:x" size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.auth-notice {
  position: relative;
  z-index: 1;
  overflow: hidden;
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border);
  font-weight: 700;

  @include countdown-bar('auth-notice--paused');
}

.auth-notice--info {
  background: var(--color-yellow);
}

// Status "reading" green: ink text, AA contrast.
.auth-notice--success {
  background: var(--status-reading);
}

// White on `crimson`: at least 4.5:1 (checked by `contrast.spec.ts`).
.auth-notice--error {
  background: var(--color-crimson);
  color: var(--color-surface);
}

.auth-notice__text {
  margin: 0;
}

.auth-notice__close {
  @include dismiss-button;
}
</style>
