<script setup lang="ts">
// Note moyenne et nombre de membres : publics, visibles sans connexion (US-02, RG-04).
// La moyenne n'est affichée qu'à partir de `minRatings` notes ; en dessous, seul le nombre de notes.
// Le nombre de membres est toujours affiché, zéro compris.
withDefaults(
  defineProps<{
    average: number | null
    ratingCount: number
    memberCount: number
    minRatings?: number
  }>(),
  { minRatings: 10 },
)
const { t, locale } = useI18n()

const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value)
</script>

<template>
  <div class="rating">
    <div class="rating__score" data-testid="work-rating">
      <span class="rating__label">{{ t('work.rating.label') }}</span>
      <strong class="rating__value">{{ average === null ? '—' : formatNumber(average) }}</strong>
      <span class="rating__label">
        {{ t('work.rating.count', { count: formatNumber(ratingCount) }, ratingCount) }}
      </span>
    </div>
    <div class="rating__details">
      <p class="rating__members" data-testid="work-members">
        <span class="rating__label">{{ t('work.rating.members') }}</span
        >{{ ' ' }}<strong>{{ formatNumber(memberCount) }}</strong>
      </p>
      <p v-if="average === null" class="rating__label">
        {{ t('work.rating.threshold', { min: minRatings }) }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rating {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rating__score {
  display: grid;
  justify-items: center;
  padding: 6px 14px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
  text-align: center;
}

.rating__label {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

.rating__value {
  font-size: 1.25rem;
  line-height: 1.1;
}

.rating__members {
  font-size: 0.75rem;
}

.rating__details {
  display: grid;
  gap: 2px;
}
</style>
