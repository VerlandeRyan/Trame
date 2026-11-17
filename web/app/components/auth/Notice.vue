<script setup lang="ts">
import { authNoticeFor } from '~/utils/auth'

/**
 * Sign-in banner, coming from the address (`?auth_error=`) or set by code (`useAuthNotice`);
 * the latter disappears on the next navigation. It follows the address: without the parameter
 * (a new page, another sign-in) there is no query banner.
 */
const { te } = useI18n()
const route = useRoute()
const router = useRouter()
const postedNotice = useAuthNotice()

const queryNotice = ref(authNoticeFor(route.query.auth_error, te))
const notice = computed(() => postedNotice.value ?? queryNotice.value)

watch(
  () => route.query.auth_error,
  (reason) => (queryNotice.value = authNoticeFor(reason, te)),
)

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
  <!-- The key includes the tone: a new notice restarts the bar with its own delay. -->
  <AuthNoticeBar
    v-if="notice"
    :key="`${notice.key}-${notice.tone}`"
    :notice="notice"
    @dismiss="dismiss"
  />
</template>
