<script setup lang="ts">
import type { ApiError } from '~/utils/api-error'
import {
  ANONYMOUS,
  HANDLE_MAX_LENGTH,
  SIGNUP_CANCELLED,
  isValidHandle,
  safeReturnTo,
} from '~/utils/auth'

// Choix du pseudo à la première connexion : le compte n'existe qu'ensuite.
definePageMeta({ layout: 'signup' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const api = useApi()
const { state, createAccount, cancelSignup } = useAuth()

useHead({ title: () => t('auth.handle.title'), meta: [{ name: 'robots', content: 'noindex' }] })

if (state.value.status !== 'pending') await navigateTo(localePath('/'), { replace: true })

const returnTo = safeReturnTo(route.query.returnTo)
const handle = ref('')
const errorMessage = ref('')
const submitting = ref(false)
const confirmingCancel = ref(false)
const canSubmit = computed(() => isValidHandle(handle.value) && !submitting.value)

watch(handle, () => {
  errorMessage.value = ''
})

async function submitHandle() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await createAccount(handle.value)
    await navigateTo(returnTo, { replace: true })
  } catch (error) {
    const apiError = error as ApiError
    if (apiError.code === 'SIGNUP_EXPIRED') {
      state.value = ANONYMOUS
      await navigateTo({ path: localePath('/'), query: { auth_error: apiError.code } })
    } else {
      errorMessage.value = t(api.messageKeyFor(apiError))
    }
  } finally {
    submitting.value = false
  }
}

async function abandonSignup() {
  try {
    await cancelSignup()
  } catch (error) {
    errorMessage.value = t(api.messageKeyFor(error as ApiError))
    return
  }
  await navigateTo({ path: localePath('/'), query: { auth_error: SIGNUP_CANCELLED } })
}
</script>

<template>
  <UiPanel class="handle">
    <ol class="handle__steps" :aria-label="t('auth.handle.steps')">
      <li class="handle__step">
        <span class="handle__step-number" aria-hidden="true">1</span
        >{{ t('auth.handle.stepSignIn') }}
      </li>
      <li class="handle__separator" aria-hidden="true">
        <Icon name="tabler:chevron-right" size="14" />
      </li>
      <li class="handle__step handle__step--current" aria-current="step">
        <span class="handle__step-number" aria-hidden="true">2</span
        >{{ t('auth.handle.stepHandle') }}
      </li>
    </ol>
    <h1 class="handle__title">{{ t('auth.handle.title') }}</h1>
    <p class="handle__intro">{{ t('auth.handle.intro') }}</p>
    <form class="handle__form" novalidate @submit.prevent="submitHandle">
      <UiField
        id="handle"
        v-model="handle"
        :label="t('auth.handle.label')"
        :hint="t('auth.handle.hint')"
        :error="errorMessage"
        prefix="@"
        :input-attributes="{ maxlength: HANDLE_MAX_LENGTH, autocomplete: 'username' }"
      />
      <p v-if="isValidHandle(handle)" class="handle__address" data-testid="handle-address">
        {{ t('auth.handle.profileAddress') }} <strong>/u/{{ handle }}</strong>
      </p>
      <p class="handle__visibility">
        <Icon name="tabler:eye" size="18" aria-hidden="true" />{{ t('auth.handle.visibility') }}
      </p>
      <UiButton
        block
        class="handle__submit"
        :disabled="!canSubmit"
        data-testid="handle-submit"
        @click="submitHandle"
      >
        {{ t('auth.handle.submit') }}
      </UiButton>
    </form>
    <button
      type="button"
      class="handle__cancel"
      data-testid="handle-cancel"
      @click="confirmingCancel = true"
    >
      {{ t('auth.handle.cancel') }}
    </button>
    <UiConfirm
      v-model="confirmingCancel"
      :title="t('auth.handle.confirmCancel.title')"
      :text="t('auth.handle.confirmCancel.text')"
      :confirm-label="t('auth.handle.confirmCancel.confirm')"
      :cancel-label="t('auth.handle.confirmCancel.keep')"
      :close-label="t('action.close')"
      @confirm="abandonSignup"
    />
  </UiPanel>
</template>

<style scoped lang="scss">
.handle {
  display: grid;
  gap: var(--space-3);
  width: min(480px, 100%);
  margin-inline: auto;
}

.handle__steps {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.handle__step {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.handle__separator {
  display: flex;
  margin-inline: calc(var(--space-1) * -1);
}

.handle__step-number {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: var(--border);
  border-radius: 50%;
}

.handle__step--current .handle__step-number {
  background: var(--color-blue);
  color: #fff;
}

.handle__title {
  color: var(--color-blue);
  font-size: 1.5rem;
}

.handle__intro,
.handle__address {
  margin: 0;
}

.handle__form {
  display: grid;
  gap: var(--space-3);
}

.handle__visibility {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--color-field-soft);
  font-size: 0.875rem;
}

.handle__cancel {
  justify-self: center;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 0;
  background: none;
  color: var(--color-ink);
  text-decoration: underline;
  cursor: pointer;
}
</style>
