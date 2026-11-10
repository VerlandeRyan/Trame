<script setup lang="ts">
/**
 * Site header: logo, search, language, sign-in. On mobile, search is an icon that unfolds the
 * field inside the header.
 */
const { t, locales } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { state: auth } = useAuth()
const signInOpen = useSignInModal()
const isAdmin = computed(
  () => auth.value.status === 'authenticated' && auth.value.user.role === 'admin',
)

// In any language: when the language changes, `localePath` already follows the new language
// while `route.path` is still the old one, which would make the search field flicker.
/** Whether the current route is the given page, in any language. */
const isCurrentPage = (path: string) =>
  locales.value.some(({ code }) => route.path === localePath(path, code))
const onSearchPage = computed(() => isCurrentPage('/search'))
// The home page has its own search field: none in the header.
const onHomePage = computed(() => isCurrentPage('/'))

// Below 1024 px the header field is too narrow for the full help text.
const isCompact = useNarrowScreen(1023)

const searching = ref(false)
const searchBox = ref<{ focus: () => void } | null>(null)
const searchLink = ref<HTMLButtonElement | null>(null)

// Explore menu: opening the search closes it (never two crosses at once).
const exploring = ref(false)
/** Opens the search field and focuses it. */
async function openSearch() {
  exploring.value = false
  searching.value = true
  await nextTick()
  searchBox.value?.focus()
}

/** Closes the search field and gives focus back to the icon. */
async function closeSearch() {
  searching.value = false
  await nextTick()
  searchLink.value?.focus()
}

/** Escape closes the field (the suggestions menu takes priority). */
function onEscape(event: KeyboardEvent) {
  if (searching.value && !event.defaultPrevented) void closeSearch()
}

// A navigation closes the field and the Explore menu (the menu is unmounted on the search page:
// it cannot close itself in time, so the state has to stay here).
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
    <span v-if="isAdmin" class="layout-header__badge" data-testid="admin-badge">
      {{ t('nav.admin.badge') }}
    </span>
    <LayoutSearchBox
      v-if="!onHomePage"
      ref="searchBox"
      class="layout-header__search"
      :placeholder="isCompact ? t('nav.searchPlaceholderShort') : undefined"
    />
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
      :is-admin="isAdmin"
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

  // Dense ink screentone on the right, fading to the left.
  &::before {
    @include screentone(var(--color-ink), 6px, 270deg, 55%);
  }

  > * {
    position: relative;
  }
}

.layout-header__logo {
  @include touch-target;

  color: var(--color-ink);
  font-size: 1.375rem;
  font-weight: var(--weight-title);
  text-decoration: none;
}

// "ADMIN" pill next to the logo: shows at a glance that the session is an administrator's.
.layout-header__badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius);
  background: var(--color-ink);
  color: var(--color-surface);
  font-size: 0.6875rem;
  font-weight: 800;
}

// On a small screen the room goes to the account and the menu.
@media (max-width: 479px) {
  .layout-header__badge {
    display: none;
  }
}

.layout-header__search {
  flex: 1;
}

.layout-header__language {
  margin-left: auto;
}

// The other elements keep their width: the account (truncated handle) absorbs the lack of room.
.layout-header__logo,
.layout-header__language {
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .layout-header__explore {
    margin-left: auto;
  }

  .layout-header__explore ~ .layout-header__language {
    margin-left: 0;
  }
}

// Open / close the search: mobile only.
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

// Mobile: compact header (logo, search as an icon, language, account).
@media (max-width: 767px) {
  .layout-header {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  // The logo keeps its width; search (icon), language and account form a group pushed to the right.
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

  // Small screens (320–399 px): everything must fit on one line without horizontal scrolling.
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

  // Very small screens (< 360 px): the account becomes an icon; the label is still read by
  // screen readers. Fonts vary between systems: keep some margin.
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
