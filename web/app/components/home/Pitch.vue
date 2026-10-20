<script setup lang="ts">
const { t } = useI18n()
const signInOpen = useSignInModal()

// Les trois engagements du panneau ; les textes sont dans `home.pitch.*`.
const pillars = [
  { key: 'tracking', icon: 'tabler:bookmark', color: 'reading' },
  { key: 'everything', icon: 'tabler:books', color: 'plan' },
  { key: 'catalogue', icon: 'tabler:compass', color: 'featured' },
] as const
</script>

<template>
  <section class="pitch" :aria-label="t('home.pitch.title')" data-testid="home-pitch">
    <span class="pitch__sticker" aria-hidden="true">{{ t('home.pitch.title') }}</span>
    <div class="pitch__card">
      <ul>
        <li v-for="pillar in pillars" :key="pillar.key" class="pitch__item">
          <span class="pitch__icon" :class="`pitch__icon--${pillar.color}`">
            <Icon :name="pillar.icon" size="24" aria-hidden="true" />
          </span>
          <div>
            <h3 class="pitch__heading">{{ t(`home.pitch.${pillar.key}.title`) }}</h3>
            <p class="pitch__text">{{ t(`home.pitch.${pillar.key}.text`) }}</p>
          </div>
        </li>
      </ul>
      <div class="pitch__cta">
        <UiButton
          block
          class="pitch__button"
          data-testid="home-create-list"
          @click="signInOpen = true"
        >
          {{ t('home.pitch.createList') }}
        </UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pitch {
  position: relative;
  padding-top: var(--space-4);
}

// Autocollant incliné posé sur le bord haut de la carte.
.pitch__sticker {
  position: absolute;
  top: 0;
  left: var(--space-4);
  z-index: 2;
  padding: 1px 10px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-rose);
  box-shadow: var(--shadow-small);
  font-size: 0.78rem;
  font-weight: 800;
  transform: rotate(-2deg);
}

.pitch__card {
  padding: 20px 14px 14px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);

  @media (min-width: 768px) {
    padding: 22px 22px 18px;
  }
}

.pitch__item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 0;
  border-top: 1px dashed var(--color-rule);

  &:first-child {
    border-top: 0;
  }

  @media (min-width: 768px) {
    gap: 14px;
    padding: 14px 0;
  }
}

.pitch__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: var(--border);
  border-radius: var(--radius);

  @media (min-width: 768px) {
    width: 44px;
    height: 44px;
  }
}

.pitch__icon--reading {
  background: var(--status-reading);
}

.pitch__icon--plan {
  background: var(--status-plan_to_read);
}

.pitch__icon--featured {
  background: var(--color-yellow);
}

.pitch__heading {
  color: var(--color-ink);
  font-size: 0.95rem;

  @media (min-width: 768px) {
    font-size: 1rem;
  }
}

.pitch__text {
  margin-top: 2px;
  font-size: 0.8rem;
  line-height: 1.35;

  @media (min-width: 768px) {
    font-size: 0.88rem;
    line-height: 1.45;
  }
}

// Filet d'encre plein au-dessus du bouton, qui occupe toute la largeur de la carte.
.pitch__cta {
  margin-top: 6px;
  padding-top: 14px;
  border-top: var(--border);
}

.pitch__button {
  min-height: 48px;
}
</style>
