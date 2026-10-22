<script setup lang="ts">
import { CONTINUE_READING_SIZE, SHELF_SIZE, type FeaturedWork, type RatedWork } from '~/utils/home'
import { countEntriesOfAllStatuses, type ListedEntry, type ListPage } from '~/utils/reading-list'
import type { WorkPage } from '~/utils/search'

// `path: '/'` fait de ce fichier la racine. `trame: 'hero'` : la trame du bord droit reste dans la
// bande du hero, le layout n'affiche pas sa colonne fixe.
definePageMeta({ path: '/', trame: 'hero' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const api = useApi()

/** Œuvres en cours d'un membre ; `isReadingListEmpty` : aucune œuvre, tous statuts confondus. */
interface ContinueReadingData {
  items: ListedEntry[]
  isReadingListEmpty: boolean
}

interface HomeData {
  featured: FeaturedWork[]
  recent: WorkPage['items']
  topRated: RatedWork[]
  continueReading: ContinueReadingData | null
}

// Tampons du hero, dans l'ordre de la maquette ; libellés dans `genre.*`.
const STAMP_FORMATS = ['manga', 'bd', 'webtoon', 'webcomic', 'comics']

// Seul un membre connecté a un accueil personnalisé (`pending` : pseudo pas encore choisi).
const auth = useAuth()
const member = computed(() =>
  auth.state.value.status === 'authenticated' ? auth.state.value.user : null,
)
const memberHandle = computed(() => (member.value ? `@${member.value.handle}` : ''))
const cookieHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

// Un bloc dont l'appel échoue est masqué : une panne ne casse pas l'accueil.
async function loadOrFallback<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request
  } catch {
    return fallback
  }
}

// Une panne laisse la bande absente (`null`) : on ne la prend pas pour une liste vide.
async function loadContinueReading(lang: string): Promise<ContinueReadingData | null> {
  if (!member.value) return null
  return loadOrFallback<ContinueReadingData | null>(
    api
      .request<ListPage>('/me/entries', {
        query: { lang, status: 'reading', sort: 'updated', pageSize: CONTINUE_READING_SIZE },
        headers: cookieHeaders,
      })
      .then((page) => ({
        items: page.items,
        isReadingListEmpty: countEntriesOfAllStatuses(page.statusCounts) === 0,
      })),
    null,
  )
}

async function loadHomeBlocks(): Promise<HomeData> {
  const lang = locale.value
  const [featured, recent, topRated, continueReading] = await Promise.all([
    loadOrFallback(api.request<{ items: FeaturedWork[] }>('/works/featured', { query: { lang } }), {
      items: [],
    }),
    loadOrFallback(
      api.request<WorkPage>('/works', { query: { lang, sort: 'recent', pageSize: SHELF_SIZE } }),
      { items: [], page: 1, pageSize: SHELF_SIZE, total: 0, approximate: false },
    ),
    loadOrFallback(api.request<{ items: RatedWork[] }>('/works/top-rated', { query: { lang } }), {
      items: [],
    }),
    loadContinueReading(lang),
  ])
  return {
    featured: featured.items,
    recent: recent.items,
    topRated: topRated.items,
    continueReading,
  }
}

const { data } = await useAsyncData<HomeData>(
  () => `home-${locale.value}-${member.value ? 'member' : 'visitor'}`,
  loadHomeBlocks,
  { watch: [locale, member] },
)

const isReadingListEmpty = computed(() => data.value?.continueReading?.isReadingListEmpty === true)

const searchBox = ref<{ submit: () => void } | null>(null)

// Au mobile, le champ n'a que « Rechercher… ».
const narrow = useNarrowScreen()
const placeholder = computed(() =>
  narrow.value ? t('home.searchPlaceholderShort') : t('home.searchPlaceholder'),
)

useHead({ title: () => t('app.name') })
</script>

<template>
  <div class="home">
    <section
      class="home__hero"
      :class="{ 'home__hero--empty': isReadingListEmpty }"
      :data-testid="isReadingListEmpty ? 'home-empty' : undefined"
    >
      <div class="home__lead" :class="{ 'home__lead--member': member }">
        <template v-if="member">
          <h1 class="home__title" data-testid="home-title">
            {{
              t(isReadingListEmpty ? 'home.empty.title' : 'home.member.welcomeBack', {
                handle: memberHandle,
              })
            }}
          </h1>
          <p class="home__intro" data-testid="home-intro">
            {{ t(isReadingListEmpty ? 'home.empty.text' : 'home.member.subtitle') }}
          </p>
        </template>
        <template v-else>
          <h1 class="home__title" data-testid="home-title">
            {{ t('home.title') }}
            <span class="home__highlight">{{ t('home.titleHighlight') }}</span>
          </h1>
          <!-- Décor : les formats sont déjà dans le texte et dans la recherche. -->
          <ul class="home__stamps" aria-hidden="true" data-testid="home-stamps">
            <li v-for="format in STAMP_FORMATS" :key="format" class="home__stamp">
              {{ t(`genre.${format}`) }}
            </li>
          </ul>
          <p class="home__intro" data-testid="home-intro">
            <i18n-t keypath="home.intro" scope="global">
              <template #favorites>
                <mark class="home__keyword">{{ t('home.introFavorites') }}</mark>
              </template>
              <template #hit>
                <mark class="home__keyword">{{ t('home.introHit') }}</mark>
              </template>
            </i18n-t>
          </p>
        </template>
        <div class="home__search">
          <LayoutSearchBox
            ref="searchBox"
            variant="hero"
            :placeholder="placeholder"
            class="home__field"
          />
          <UiButton
            class="home__submit"
            data-testid="home-search-submit"
            @click="searchBox?.submit()"
          >
            {{ t('nav.search') }}
          </UiButton>
        </div>

        <div v-if="isReadingListEmpty" class="home__formats" data-testid="home-formats">
          <p class="home__formats-label">{{ t('home.empty.orFormat') }}</p>
          <ul class="home__formats-list">
            <li v-for="format in STAMP_FORMATS" :key="format">
              <NuxtLink
                :to="{ path: localePath('/search'), query: { format } }"
                class="home__format"
                :data-testid="`home-format-${format}`"
              >
                {{ t(`genre.${format}`) }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <HomeContinueReading
        v-if="data?.continueReading && !isReadingListEmpty"
        :entries="data.continueReading.items"
        class="home__continue-reading"
      />

      <HomePitch v-if="!member" class="home__pitch" />
    </section>

    <div class="home__body">
      <HomeFeatured v-if="data?.featured.length" :works="data.featured" />

      <HomeShelf
        v-if="data?.recent.length"
        test-id="home-recent"
        :title="t('home.recent.title')"
        :works="data.recent"
        :see-all-to="{ path: localePath('/search'), query: { sort: 'recent' } }"
      />

      <HomeShelf
        v-if="data?.topRated.length"
        test-id="home-top-rated"
        :title="t('home.topRated.title')"
        :works="data.topRated"
      />

      <!-- Inactif jusqu'à US-09 (proposition d'une œuvre, connexion requise). -->
      <UiPanel class="home__missing" data-testid="home-missing">
        <div>
          <h2 class="home__missing-title">{{ t('home.missing.title') }}</h2>
          <p class="home__missing-text">{{ t('home.missing.text') }}</p>
        </div>
        <UiButton disabled class="home__propose" data-testid="home-propose">
          {{ t('home.missing.signIn') }}
        </UiButton>
      </UiPanel>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Bandes pleine largeur : on annule les marges de `<main>`, la page pose les siennes.
.home {
  margin: calc(-1 * var(--main-pad-top)) calc(-1 * var(--main-pad-x))
    calc(-1 * var(--main-pad-bottom));
  --rule-gap: 14px;
}

// La trame du bord droit (décor, sans clic) s'arrête au filet de la bande.
.home__hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) 48px;
  align-items: center;
  padding: 22px 14px 20px;
  background: var(--color-field-soft);
  border-bottom: var(--border);

  &::before {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 24%;
    background-image: radial-gradient(circle, var(--color-trame-side) 36%, transparent 42%);
    background-size: 7px 7px;
    opacity: 0.4;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(270deg, #000, transparent 90%);
    mask-image: linear-gradient(270deg, #000, transparent 90%);
    content: '';
  }

  > * {
    position: relative;
  }

  @media (min-width: 768px) {
    padding: 40px max(40px, calc(40px + (100vw - 1280px) * 0.35)) 34px 40px;
    gap: 28px 48px;

    &::before {
      width: 30%;
    }
  }
}

// Colonne de gauche : au mobile l'ordre visuel est titre, sous-titre, tampons, recherche.
.home__lead {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  min-width: 0;

  @media (min-width: 768px) {
    flex: 1 1 480px;
    max-width: 820px;
  }
}

.home__pitch {
  flex: 1 1 100%;
  min-width: 0;
  margin-top: var(--space-3);

  @media (min-width: 768px) {
    flex: 0 1 440px;
    margin-top: 0;
    margin-left: auto;
  }
}

// Membre : pas de tampons ni de sous-titre inversé, l'ordre du DOM suffit.
.home__lead.home__lead--member > * {
  order: 0;
}

// La bande occupe toute la largeur du hero, sous la recherche.
.home__continue-reading {
  flex: 1 1 100%;
  min-width: 0;
  margin-top: var(--space-2);
}

// Liste vide : au bureau, titre, recherche et formats sont centrés.
.home__hero--empty {
  @media (min-width: 768px) {
    justify-content: center;
    text-align: center;

    .home__lead {
      align-items: center;
    }

    // Le centrage ne doit pas gagner le menu de suggestions.
    .home__search {
      width: 100%;
      margin-inline: auto;
      text-align: start;
    }
  }
}

.home__formats-label {
  margin: var(--space-4) 0 var(--space-2);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 800;
}

.home__formats-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);

  @media (min-width: 768px) {
    justify-content: center;
  }
}

// Formats cliquables : mêmes pastilles blanches que les tampons, mais droites et de 44 px.
.home__format {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-small);
  background: var(--color-surface);
  color: var(--color-ink);
  font-weight: 800;
  text-decoration: none;

  @include tilt-on-hover(var(--color-rose));
}

.home__title {
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.85rem;
  line-height: 1.1;
  text-wrap: balance;

  @media (min-width: 768px) {
    font-size: clamp(2.2rem, 4vw, 3.2rem);
  }
}

// Soulignement au feutre rose (bleu sur rose : 3,2:1, suffisant pour de gros caractères).
.home__highlight {
  background: linear-gradient(transparent 62%, var(--color-rose) 62%);
}

// Tampons blancs inclinés, non cliquables, sur une seule ligne (au mobile comme au bureau).
.home__stamps {
  display: flex;
  gap: 6px;
  order: 2;
  margin: 0 0 var(--space-3);
  // Une ligne jusqu'à 320 px : le corps suit la largeur (décor, masqué aux lecteurs d'écran).
  font-size: min(0.78rem, 2.9vw);

  @media (min-width: 768px) {
    gap: var(--space-3);
    order: 0;
    margin: 14px 0 16px;
    font-size: 1rem;
  }
}

.home__stamp {
  padding: 2px 6px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  font-weight: 800;
  white-space: nowrap;

  &:nth-child(1) {
    transform: rotate(-2deg);
  }

  &:nth-child(2) {
    transform: rotate(1.5deg);
  }

  &:nth-child(3) {
    transform: rotate(-1deg);
  }

  &:nth-child(4) {
    transform: rotate(2deg);
  }

  &:nth-child(5) {
    transform: rotate(-1.5deg);
  }

  @media (min-width: 768px) {
    padding: 3px 12px;
  }
}

// Une ligne au bureau (la colonne est assez large), deux lignes au mobile.
.home__intro {
  order: 1;
  margin: var(--space-2) 0 var(--space-3);
  font-size: 1.02rem;
  font-weight: 600;

  @media (min-width: 768px) {
    order: 0;
    margin: 0;
    font-size: 1.2rem;
    white-space: nowrap;
  }
}

.home__keyword {
  padding: 0 2px;
  background: linear-gradient(transparent 55%, var(--color-cyan) 55%);
  color: inherit;
  font-weight: 700;
}

.home__search {
  display: flex;
  order: 3;
  gap: 10px;
  max-width: 640px;
  margin-top: 10px;

  @media (min-width: 768px) {
    order: 0;
    margin-top: var(--space-4);
  }
}

.home__field {
  flex: 1;

  @media (min-width: 768px) {
    :deep(.search-box__input) {
      min-height: 60px;
      font-size: 1.05rem;
    }
  }
}

// Au mobile, Entrée suffit : le bouton n'existe qu'à partir de la tablette.
.home__submit {
  @media (max-width: 767px) {
    display: none;
  }

  @media (min-width: 768px) {
    min-height: 60px;
  }
}

// Blocs séparés de 26 px, y compris entre le hero et le premier.
.home__body {
  display: grid;
  gap: 26px;
  padding: 44px 14px 24px;

  @media (min-width: 768px) {
    padding: 52px 40px 34px;
  }
}

.home__missing {
  display: grid;
  gap: var(--space-3);
  align-items: start;
  padding: 18px 22px;

  @media (min-width: 768px) {
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 20px;
  }
}

// Garde sa largeur au mobile.
.home__propose {
  justify-self: start;
}

.home__missing-title {
  color: var(--color-ink);
  font-size: 1rem;
}

.home__missing-text {
  margin: 4px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
}
</style>
