<script setup lang="ts">
import { authNoticeFor } from '~/utils/auth'

// Bandeau de connexion, venu de l'adresse (`?auth_error=`) ou posé par le code (`useAuthNotice`) ;
// ce dernier disparaît à la navigation suivante.
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

// Vert « En cours » des statuts : texte d'encre, contraste AA (voir web/CLAUDE.md).
.auth-notice--success {
  background: var(--status-reading);
}

// Blanc sur `crimson` : 4,5:1 au moins (`contrast.spec.ts`).
.auth-notice--error {
  background: var(--color-crimson);
  color: #fff;
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
