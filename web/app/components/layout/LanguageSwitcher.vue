<script setup lang="ts">
// Sélecteur de la langue d'interface : navigue vers la même page dans l'autre langue.
const { t, locale, localeCodes, setLocale } = useI18n()

async function goToLocale(event: Event) {
  const selectedCode = (event.target as HTMLSelectElement).value as typeof locale.value
  await setLocale(selectedCode)
}
</script>

<template>
  <div class="language-switcher">
    <Icon name="tabler:world" size="16" aria-hidden="true" />
    <select
      class="language-switcher__select"
      :value="locale"
      :aria-label="t('nav.languageLabel')"
      @change="goToLocale"
    >
      <option v-for="code in localeCodes" :key="code" :value="code">
        {{ code.toUpperCase() }}
      </option>
    </select>
  </div>
</template>

<style scoped lang="scss">
.language-switcher {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.language-switcher__select {
  border: 0;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;
}

// 16 px minimum : évite le zoom automatique de Safari iOS à la prise de focus.
@media (max-width: 767px) {
  .language-switcher {
    padding: 0 var(--space-2);
  }

  .language-switcher__select {
    font-size: 1rem;
  }
}
</style>
