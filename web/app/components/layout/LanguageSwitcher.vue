<script setup lang="ts">
// Sélecteur de la langue d'interface : un bouton (toute la carte est cliquable) qui ouvre un menu
// de liens vers la même page dans chaque langue.
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
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

function close({ restoreFocus = false } = {}) {
  isOpen.value = false
  if (restoreFocus) trigger.value?.focus()
}

function closeOnOutsideClick(event: MouseEvent) {
  if (isOpen.value && !root.value?.contains(event.target as Node)) close()
}

// Échap sur le document : Safari ne donne pas le focus à un bouton cliqué, un `keydown` posé sur
// le composant ne serait donc jamais reçu.
function closeOnEscape(event: KeyboardEvent) {
  if (isOpen.value && event.key === 'Escape') close({ restoreFocus: true })
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})

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
          <span class="language-switcher__name">{{ item.name }}</span>
          <span class="language-switcher__item-code">{{ item.code.toUpperCase() }}</span>
          <Icon
            v-if="item.isCurrent"
            name="tabler:check"
            size="18"
            aria-hidden="true"
            class="language-switcher__check"
          />
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
  gap: var(--space-3);
  width: 100%;
  min-height: var(--touch);
  padding: 0 var(--space-4);
  color: var(--color-ink);
  font-weight: 700;
  text-decoration: none;

  // Survol et focus : seul signal de fond. La langue courante se reconnaît à la coche et au gras,
  // sans fond propre, pour ne pas être confondue avec la ligne survolée.
  &:hover,
  &:focus-visible {
    background: var(--color-field);
  }
}

.language-switcher__item--current {
  font-weight: 800;
}

.language-switcher__name {
  flex: 1;
}

.language-switcher__item-code {
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}

.language-switcher__check {
  color: var(--color-blue);
}
</style>
