<script setup lang="ts">
// Compte connecté : le pseudo et son menu. Les entrées sans page (soumissions)
// sont visibles mais inactives en attendant leur ticket.
const props = defineProps<{ handle: string; isAdmin?: boolean }>()
const PLANNED_ITEMS = [
  { labelKey: 'nav.proposeWork', testId: 'propose-work-link' },
  { labelKey: 'nav.mySubmissions', testId: 'my-submissions-link' },
]
const PLANNED_ADMIN_ITEMS = [
  { labelKey: 'nav.admin.submissions', testId: 'admin-submissions-link' },
  { labelKey: 'nav.admin.reports', testId: 'admin-reports-link' },
]
const initial = computed(() => props.handle.charAt(0).toUpperCase())
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

// Les middlewares ne jouent qu'à la navigation : une page réservée aux membres ou aux
// administrateurs reste affichée après la déconnexion si on n'en sort pas.
const MEMBER_PAGE_MIDDLEWARE = new Set(['authenticated', 'admin'])
const route = useRoute()
const isMemberPage = () =>
  [route.meta.middleware].flat().some((name) => MEMBER_PAGE_MIDDLEWARE.has(String(name)))

// Le résultat est annoncé dans le bandeau : vert si déconnecté, rouge si l'échec laisse connecté.
// Depuis une page réservée on revient à l'accueil : l'avis traverse cette redirection.
async function confirmSignOut() {
  try {
    await signOut()
  } catch {
    notice.value = { key: 'auth.signOutFailed', tone: 'error' }
    return
  }
  const isRedirected = isMemberPage()
  notice.value = { key: 'auth.signedOut', tone: 'success', ...(isRedirected && { keepOnce: true }) }
  if (isRedirected) await navigateTo(localePath('/'))
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
      <p class="account-menu__who">
        <span class="account-menu__avatar" aria-hidden="true">{{ initial }}</span>
        <span class="account-menu__who-handle">@{{ handle }}</span>
      </p>
      <NuxtLink
        :to="localePath('/list')"
        class="account-menu__row"
        data-testid="my-list-link"
        @click="close()"
      >
        {{ t('nav.myList') }}
      </NuxtLink>
      <NuxtLink
        :to="localePath(`/u/${handle}`)"
        class="account-menu__row"
        data-testid="profile-link"
        @click="close()"
      >
        {{ t('nav.profile') }}
      </NuxtLink>
      <button
        v-for="item in PLANNED_ITEMS"
        :key="item.testId"
        type="button"
        class="account-menu__row"
        disabled
        :data-testid="item.testId"
      >
        {{ t(item.labelKey) }}
      </button>
      <section v-if="isAdmin" class="account-menu__group" data-testid="admin-group">
        <p class="account-menu__group-title">{{ t('nav.admin.title') }}</p>
        <NuxtLink
          :to="localePath('/admin/catalogue')"
          class="account-menu__row"
          data-testid="admin-catalogue-link"
          @click="close()"
        >
          {{ t('nav.admin.catalogue') }}
        </NuxtLink>
        <button
          v-for="item in PLANNED_ADMIN_ITEMS"
          :key="item.testId"
          type="button"
          class="account-menu__row"
          disabled
          :data-testid="item.testId"
        >
          {{ t(item.labelKey) }}
        </button>
      </section>
      <button
        type="button"
        class="account-menu__row account-menu__row--sign-out"
        data-testid="sign-out"
        @click="askSignOut"
      >
        {{ t('auth.signOut') }}
      </button>
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
@use '~/assets/styles/mixins' as *;

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
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 40;
  width: 280px;
  max-width: calc(100vw - 32px);
  // Le menu complet dépasse un petit écran en hauteur.
  max-height: calc(100dvh - 5rem);
  overflow-y: auto;
  padding: 4px 16px 8px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-paper);
  box-shadow: var(--shadow);
}

.account-menu__who {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 12px 0 8px;
  font-weight: 800;
}

.account-menu__who-handle {
  min-width: 0;
  overflow-wrap: anywhere;
}

.account-menu__avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: var(--border);
  border-radius: 50%;
  background: var(--color-rose);
  font-size: 0.9rem;
}

// Lignes à plat comme la maquette : filet, chevron, aucun cadre de bouton.
.account-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 52px;
  padding: 0;
  border: 0;
  border-bottom: 2px solid var(--color-rule);
  background: none;
  color: var(--color-ink);
  font: 800 1.05rem var(--font-sans);
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  // Le chevron est décoratif : le second `content` (texte alternatif vide) le retire du nom accessible.
  &::after {
    content: '›';
    content: '›' / '';
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // Même fond que le menu des langues, débordant de 8 px de chaque côté sans toucher aux filets.
  &:focus-visible {
    background: var(--color-field);
    box-shadow:
      -8px 0 0 var(--color-field),
      8px 0 0 var(--color-field);
  }

  @include on-hover {
    background: var(--color-field);
    box-shadow:
      -8px 0 0 var(--color-field),
      8px 0 0 var(--color-field);
  }
}

// Le filet de la dernière ligne ferait double trait avec le titre du groupe.
.account-menu__row:has(+ .account-menu__group) {
  border-bottom: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .account-menu__panel {
    animation: account-menu-in 0.12s ease-out;
  }

  @keyframes account-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
}

.account-menu__row--sign-out {
  border-bottom: 0;
  color: var(--color-danger);

  &::after {
    content: none;
  }
}

.account-menu__group-title {
  margin: 12px 0 0;
  padding-top: 8px;
  border-top: 2px solid var(--color-ink);
  color: var(--color-ink-soft);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
