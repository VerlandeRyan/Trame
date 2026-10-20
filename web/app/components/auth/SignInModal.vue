<script setup lang="ts">
import { googleLoginUrl } from '~/utils/auth'

// Fenêtre de connexion : centrée au bureau, feuille basse au mobile.
const { t } = useI18n()
const route = useRoute()
const isOpen = useSignInModal()
const narrow = useNarrowScreen()

// Retour sur la page courante, langue comprise.
const loginUrl = computed(() => googleLoginUrl(route.fullPath))

const assurances = [
  { key: 'noPassword', icon: 'tabler:lock' },
  { key: 'emailHidden', icon: 'tabler:mail-off' },
  { key: 'publicHandle', icon: 'tabler:eye' },
] as const
</script>

<template>
  <UiModal
    v-model="isOpen"
    :title="t('auth.signIn.title')"
    :close-label="t('action.close')"
    :placement="narrow ? 'bottom' : 'center'"
    plain
  >
    <div class="sign-in">
      <p class="sign-in__intro">{{ t('auth.signIn.intro') }}</p>
      <UiButton
        block
        variant="secondary"
        :href="loginUrl"
        class="sign-in__google"
        data-testid="sign-in-google"
      >
        <Icon name="tabler:brand-google" size="20" aria-hidden="true" />
        {{ t('auth.signIn.google') }}
      </UiButton>
      <ul class="sign-in__assurances">
        <li v-for="assurance in assurances" :key="assurance.key" class="sign-in__assurance">
          <Icon :name="assurance.icon" size="18" aria-hidden="true" />
          {{ t(`auth.signIn.${assurance.key}`) }}
        </li>
      </ul>
      <p class="sign-in__legal">{{ t('auth.signIn.legal') }}</p>
    </div>
  </UiModal>
</template>

<style scoped lang="scss">
// Tailles et intervalles relevés dans la maquette 15 (`.note`, `.gbtn`, `.lst`).
.sign-in__intro {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.sign-in__google {
  min-height: 48px;
  margin-top: var(--space-4);
  font-size: 0.9375rem;
  font-weight: 800;
}

.sign-in__assurances {
  margin-top: 14px;
}

.sign-in__assurance {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: 4px 0;
  font-size: 0.8125rem;

  .iconify {
    flex: none;
    color: var(--color-blue);
  }
}

.sign-in__legal {
  margin: 14px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  line-height: 1.5;
}
</style>
