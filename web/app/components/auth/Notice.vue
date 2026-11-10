<script setup lang="ts">
import { authNoticeFor } from '~/utils/auth'

/**
 * Sign-in banner, coming from the address (`?auth_error=`) or set by code (`useAuthNotice`);
 * the latter disappears on the next navigation.
 */
const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const postedNotice = useAuthNotice()

const queryNotice = ref(authNoticeFor(route.query.auth_error, te))
const notice = computed(() => postedNotice.value ?? queryNotice.value)

watch(
  () => route.fullPath,
  () => {
    const posted = postedNotice.value
    postedNotice.value = posted?.keepOnce ? { ...posted, keepOnce: false } : null
  },
)

/** Hides the banner and removes its parameter from the address. */
async function dismiss() {
  postedNotice.value = null
  queryNotice.value = null
  const query = { ...route.query }
  delete query.auth_error
  await router.replace({ query })
}
</script>

<template>
  <div
    v-if="notice"
    class="auth-notice"
    :class="`auth-notice--${notice.tone}`"
    role="alert"
    data-testid="auth-notice"
  >
    <p class="auth-notice__text">{{ t(notice.key) }}</p>
    <button
      type="button"
      class="auth-notice__close"
      :aria-label="t('action.close')"
      @click="dismiss"
    >
      <Icon name="tabler:x" size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.auth-notice {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border);
  font-weight: 700;
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
  display: grid;
  flex: none;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}
</style>
