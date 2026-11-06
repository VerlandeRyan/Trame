<script setup lang="ts">
// Sélecteur de la langue d'interface : un bouton (toute la carte est cliquable) qui ouvre un menu
// de liens vers la même page dans chaque langue.
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const { isOpen, close } = useDismissableMenu(root, () => trigger.value?.focus())
const menuId = useId()

const items = computed(() =>
  locales.value.map((entry) => ({
    code: entry.code,
    name: entry.name ?? entry.code,
    language: entry.language ?? entry.code,
    to: switchLocalePath(entry.code) || '/',
    isCurrent: entry.code === locale.value,
  })),
)

// Après le choix d'une langue, la route change : le menu se referme.
watch(
  () => route.fullPath,
  () => close(),
)
</script>

<template>
  <div ref="root" class="language-switcher">
    <button
      ref="trigger"
      type="button"
      class="language-switcher__trigger"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      :aria-label="t('nav.languageLabel')"
      @click="isOpen = !isOpen"
    >
      <Icon name="tabler:world" size="16" aria-hidden="true" />
      <span class="language-switcher__code">{{ locale.toUpperCase() }}</span>
      <Icon
        name="tabler:chevron-down"
        size="14"
        aria-hidden="true"
        class="language-switcher__chevron"
        :class="{ 'language-switcher__chevron--open': isOpen }"
      />
    </button>

    <ul v-show="isOpen" :id="menuId" class="language-switcher__menu">
      <li v-for="item in items" :key="item.code">
        <NuxtLink
          :to="item.to"
          class="language-switcher__item"
          :class="{ 'language-switcher__item--current': item.isCurrent }"
          :hreflang="item.language"
          :lang="item.language"
          :aria-current="item.isCurrent ? 'true' : undefined"
        >
          <Icon
            v-if="item.isCurrent"
            name="tabler:check"
            size="14"
            aria-hidden="true"
            class="language-switcher__check"
          />
          <span v-else class="language-switcher__check" aria-hidden="true" />
          <span class="language-switcher__name">{{ item.name }}</span>
          <span class="language-switcher__item-code">{{ item.code.toUpperCase() }}</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.language-switcher {
  position: relative;
}

// Toute la carte est le bouton : icône, code et chevron réagissent au clic.
.language-switcher__trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;
}

.language-switcher__chevron--open {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: no-preference) {
  .language-switcher__chevron {
    transition: transform 0.15s;
  }
}

.language-switcher__menu {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 20;
  min-width: 200px;
  border: var(--border);
  border-color: var(--color-blue);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
  overflow: hidden;
}

@media (prefers-reduced-motion: no-preference) {
  .language-switcher__menu {
    animation: language-menu-in 0.12s ease-out;
  }

  @keyframes language-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
}

// Chaque ligne est un lien sur toute la largeur du menu.
.language-switcher__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  color: var(--color-ink);
  font-weight: 700;
  text-decoration: none;

  // Même signal de sélection que le menu de tri (`ui/Select.vue`) : fond bleu plein, coche à gauche.
  &:focus-visible:not(.language-switcher__item--current) {
    background: var(--color-cover-empty);
  }

  // Le survol n'existe qu'à la souris : sur écran tactile il resterait collé après un toucher.
  @media (hover: hover) and (pointer: fine) {
    &:hover:not(.language-switcher__item--current) {
      background: var(--color-cover-empty);
    }
  }

  &:active:not(.language-switcher__item--current) {
    background: var(--color-cover-empty);
  }
}

.language-switcher__item--current {
  background: var(--color-blue);
  color: var(--color-surface);
  font-weight: 800;

  .language-switcher__item-code,
  .language-switcher__check {
    color: var(--color-surface);
  }

  &:focus-visible {
    outline: 3px solid var(--color-ink);
    outline-offset: -3px;
  }
}

li + li .language-switcher__item {
  border-top: 1px dashed var(--color-rule);
}

.language-switcher__name {
  flex: 1;
}

.language-switcher__item-code {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.language-switcher__check {
  display: inline-block;
  width: 14px;
  color: var(--color-blue);
}
</style>
