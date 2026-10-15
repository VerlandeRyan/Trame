<script setup lang="ts">
import { isSafeLink, type ExternalLink } from '~/utils/work'

// Boutons « Lire » et « Acheter » : liens externes en https uniquement, ouverts hors du site.
const props = defineProps<{ links: ExternalLink[] }>()
const { t } = useI18n()

const readLink = computed(() => props.links.find((l) => l.kind === 'read' && isSafeLink(l.url)))
const buyLink = computed(() => props.links.find((l) => l.kind === 'buy' && isSafeLink(l.url)))
</script>

<template>
  <div v-if="readLink || buyLink" class="actions">
    <a
      v-if="readLink"
      :href="readLink.url"
      class="actions__link"
      rel="noopener noreferrer"
      target="_blank"
      data-testid="work-read"
    >
      {{ t('work.actions.read') }}
    </a>
    <a
      v-if="buyLink"
      :href="buyLink.url"
      class="actions__link"
      rel="noopener noreferrer"
      target="_blank"
      data-testid="work-buy"
    >
      {{ t('work.actions.buy') }}
    </a>
  </div>
</template>

<style scoped lang="scss">
// Deux boutons de même largeur (maquettes) : « Lire » et « Acheter » côte à côte.
.actions {
  display: flex;
  gap: var(--space-2);
}

.actions__link {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: var(--touch);
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
}
</style>
