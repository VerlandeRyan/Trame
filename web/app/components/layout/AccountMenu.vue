<script setup lang="ts">
// Compte connecté : le pseudo et un menu réduit à la déconnexion (le reste viendra avec le profil).
defineProps<{ handle: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { signOut } = useAuth()
const notice = useAuthNotice()

const root = ref<HTMLElement | null>(null)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.$el.focus())
const menuId = useId()

const confirmingSignOut = ref(false)
function askSignOut() {
  close()
  confirmingSignOut.value = true
}

// Le résultat est annoncé dans le bandeau : vert si déconnecté, rouge si l'échec laisse connecté.
async function confirmSignOut() {
  try {
    await signOut()
    notice.value = { key: 'auth.signedOut', tone: 'success' }
  } catch {
    notice.value = { key: 'auth.signOutFailed', tone: 'error' }
  }
}
</script>

<template>
  <div ref="root" class="account-menu">
    <UiButton
      ref="trigger"
      variant="blue"
      size="small"
      class="account-menu__trigger"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      data-testid="account-menu"
      @click="isOpen = !isOpen"
    >
      <Icon name="tabler:user" size="18" aria-hidden="true" />
      <span class="account-menu__handle">@{{ handle }}</span>
    </UiButton>
    <div v-show="isOpen" :id="menuId" class="account-menu__panel">
      <UiButton
        variant="secondary"
        size="small"
        class="account-menu__item"
        :href="localePath('/list')"
        data-testid="my-list-link"
      >
        <Icon name="tabler:books" size="18" aria-hidden="true" />{{ t('nav.myList') }}
      </UiButton>
      <UiButton
        variant="secondary"
        size="small"
        class="account-menu__item"
        data-testid="sign-out"
        @click="askSignOut"
      >
        <Icon name="tabler:logout" size="18" aria-hidden="true" />{{ t('auth.signOut') }}
      </UiButton>
    </div>
    <UiConfirm
      v-model="confirmingSignOut"
      :title="t('auth.signOutConfirm.title')"
      :text="t('auth.signOutConfirm.text')"
      :confirm-label="t('auth.signOutConfirm.confirm')"
      :cancel-label="t('auth.signOutConfirm.keep')"
      :close-label="t('action.close')"
      @confirm="confirmSignOut"
    />
  </div>
</template>

<style scoped lang="scss">
// Le compte cède de la place avant que l'en-tête déborde : seul le pseudo se tronque.
.account-menu {
  position: relative;
  min-width: 0;
}

.account-menu__trigger {
  max-width: 100%;
}

.account-menu__handle {
  min-width: 0;
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (min-width: 768px) {
    max-width: 14rem;
  }
}

.account-menu__panel {
  display: grid;
  gap: var(--space-2);
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 40;
  padding: var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

.account-menu__item {
  white-space: nowrap;
}
</style>
