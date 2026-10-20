<script setup lang="ts">
// En-tête du site, d'après les maquettes : logo, recherche, langue, connexion.
// Au mobile, la recherche est une icône qui déploie le champ dans l'en-tête.
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { state: auth } = useAuth()
const signInOpen = useSignInModal()
const onSearchPage = computed(() => route.path === localePath('/search'))
// L'accueil porte son propre champ de recherche (maquettes 05 et 06) : pas de champ dans l'en-tête.
const onHomePage = computed(() => route.path === localePath('/'))

const searching = ref(false)
const searchBox = ref<{ focus: () => void } | null>(null)
const searchLink = ref<HTMLButtonElement | null>(null)

// Menu Explorer : ouvrir la recherche le referme (jamais deux croix à la fois).
const exploring = ref(false)
async function openSearch() {
  exploring.value = false
  searching.value = true
  await nextTick()
  searchBox.value?.focus()
}

async function closeSearch() {
  searching.value = false
  await nextTick()
  searchLink.value?.focus()
}

// Échap referme le champ (le menu de suggestions a priorité).
function onEscape(event: KeyboardEvent) {
  if (searching.value && !event.defaultPrevented) void closeSearch()
}

// Une navigation referme le champ et le menu Explorer (le menu est démonté sur `/search` : il ne
// peut pas se refermer lui-même à temps, l'état doit rester ici).
watch(
  () => route.fullPath,
  () => {
    searching.value = false
    exploring.value = false
  },
)
</script>

<template>
  <header
    class="layout-header"
    :class="{ 'layout-header--searching': searching, 'layout-header--plain': onHomePage }"
    @keydown.esc="onEscape"
  >
    <NuxtLink :to="localePath('/')" class="layout-header__logo">{{ t('app.name') }}</NuxtLink>
    <LayoutSearchBox v-if="!onHomePage" ref="searchBox" class="layout-header__search" />
    <button
      v-if="!onSearchPage && !onHomePage"
      ref="searchLink"
      type="button"
      class="layout-header__search-link"
      :aria-label="t('nav.openSearch')"
      :aria-expanded="searching"
      data-testid="search-open"
      @click="openSearch"
    >
      <Icon name="tabler:search" size="18" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="layout-header__search-close"
      :aria-label="t('nav.closeSearch')"
      data-testid="search-close"
      @click="closeSearch"
    >
      <Icon name="tabler:x" size="18" aria-hidden="true" />
    </button>
    <LayoutExploreMenu
      v-if="!onSearchPage"
      v-model:open="exploring"
      class="layout-header__explore"
    />
    <LayoutLanguageSwitcher class="layout-header__language" />
    <LayoutAccountMenu
      v-if="auth.status === 'authenticated'"
      :handle="auth.user.handle"
      class="layout-header__account"
    />
    <UiButton
      v-else
      variant="blue"
      size="small"
      class="layout-header__sign-in"
      data-testid="sign-in"
      @click="signInOpen = true"
    >
      <Icon
        name="tabler:user"
        size="18"
        aria-hidden="true"
        class="layout-header__sign-in-icon"
      /><span class="layout-header__sign-in-label">{{ t('nav.signIn') }}</span>
    </UiButton>
  </header>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.layout-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px;
  background: var(--color-rose);
  border-bottom: var(--border);

  @media (min-width: 768px) {
    min-height: var(--header-height);
  }

  // Trame d'encre dense à droite, qui s'estompe vers la gauche.
  &::before {
    @include screentone(var(--color-ink), 6px, 270deg, 55%);
  }

  > * {
    position: relative;
  }
}

.layout-header__logo {
  color: var(--color-ink);
  font-size: 1.375rem;
  font-weight: var(--weight-title);
  text-decoration: none;
}

.layout-header__search {
  flex: 1;
}

.layout-header__language {
  margin-left: auto;
}

@media (min-width: 768px) {
  .layout-header__explore {
    margin-left: auto;
  }

  .layout-header__explore ~ .layout-header__language {
    margin-left: 0;
  }
}

// Ouvrir / fermer la recherche : mobile seulement.
.layout-header__search-link,
.layout-header__search-close {
  display: none;
  place-items: center;
  flex: 0 0 var(--touch);
  min-height: var(--touch);
  padding: 0;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.layout-header__search-link {
  margin-left: auto;
}

.layout-header__sign-in {
  white-space: nowrap;
}

.layout-header__sign-in-icon {
  display: none;
}

// Mobile : en-tête compact (logo, recherche en icône, langue, compte).
@media (max-width: 767px) {
  .layout-header {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  // Le logo garde sa largeur ; recherche (icône), langue et compte forment un groupe collé à droite.
  .layout-header__search {
    display: none;
  }

  .layout-header > .layout-header__explore {
    position: static;
    order: 1;
  }

  .layout-header__search-link {
    display: grid;
  }

  .layout-header__language {
    margin-left: auto;
  }

  .layout-header__search-link ~ .layout-header__language {
    margin-left: 0;
  }

  .layout-header--searching {
    .layout-header__logo,
    .layout-header__explore,
    .layout-header__search-link,
    .layout-header__language,
    .layout-header__account,
    .layout-header__sign-in {
      display: none;
    }

    .layout-header__search {
      display: block;
    }

    .layout-header__search-close {
      display: grid;
    }
  }

  // Petits écrans (320–399 px) : tout doit tenir sur une ligne sans défilement horizontal.
  @media (max-width: 399px) {
    .layout-header {
      gap: 6px;
      padding-inline: var(--space-2);
    }

    .layout-header__logo {
      font-size: 1.25rem;
    }

    .layout-header__search-link {
      flex-basis: 40px;
    }

    .layout-header__language :deep(.language-switcher__trigger) {
      gap: 6px;
      padding-inline: var(--space-2);
    }

    .layout-header__sign-in {
      padding-inline: 10px;
      font-size: 0.75rem;
    }
  }

  // Très petits écrans (< 360 px) : le compte devient une icône ; le libellé reste lu par les
  // lecteurs d'écran. Les polices varient selon les systèmes : on garde de la marge.
  @media (max-width: 359px) {
    .layout-header__sign-in-icon {
      display: inline-block;
    }

    .layout-header__sign-in-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
}
</style>
