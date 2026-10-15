<script setup lang="ts">
import type { CreditRole } from '~/utils/work'

// Synopsis : langue et source indiquées ; un texte traduit automatiquement est signalé (US-02).
// Le texte est affiché en texte brut (jamais de HTML).
defineProps<{
  text: string | null
  language: string | null
  source: 'official' | 'human' | 'machine' | null
  credits: { name: string; roles: CreditRole[] }[]
}>()
const { t, locale } = useI18n()

function languageLabel(code: string): string {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
</script>

<template>
  <UiPanel class="synopsis">
    <template v-if="text">
      <p v-if="language && source" class="synopsis__source">
        <UiChip>
          <span data-testid="work-synopsis-source">
            {{ languageLabel(language) }} · {{ t(`work.synopsis.source.${source}`) }}
          </span>
        </UiChip>
      </p>
      <p class="synopsis__text" :lang="language ?? undefined" data-testid="work-synopsis">
        {{ text }}
      </p>
    </template>
    <p v-else class="synopsis__empty" data-testid="work-synopsis-empty">
      {{ t('work.synopsis.empty') }}
    </p>
    <p v-if="credits.length > 0" class="synopsis__credits" data-testid="work-credits">
      <template v-for="(credit, index) in credits" :key="credit.name">
        <span v-if="index > 0" aria-hidden="true"> · </span>
        <span class="synopsis__credit">
          {{ credit.roles.map((role) => t(`creditRole.${role}`)).join(', ') }}
          <strong>{{ credit.name }}</strong>
        </span>
      </template>
    </p>
  </UiPanel>
</template>

<style scoped lang="scss">
// Contenu empilé depuis le haut (jamais centré ni étiré) ; chip collée au bord haut du cadre.
.synopsis {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: var(--space-2);
}

.synopsis__text {
  font-size: 0.8125rem;
  line-height: 1.55;
  white-space: pre-line;
}

.synopsis__empty,
.synopsis__credits {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.synopsis__credits {
  margin-top: var(--space-1);
}

.synopsis__credits strong {
  color: var(--color-ink);
}
</style>
