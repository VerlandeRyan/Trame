<script setup lang="ts">
import { SHELF_SIZE, type FeaturedWork, type GenreItem, type RatedWork } from '~/utils/home'
import type { WorkPage } from '~/utils/search'

// `path: '/'` fait de ce fichier la racine. `trame: 'hero'` : la trame du bord droit reste dans la
// bande du hero, le layout n'affiche pas sa colonne fixe.
definePageMeta({ path: '/', trame: 'hero' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const api = useApi()

interface HomeData {
  featured: FeaturedWork[]
  recent: WorkPage['items']
  topRated: RatedWork[]
  genres: GenreItem[]
}

// Un bloc dont l'appel échoue est masqué : une panne ne casse pas l'accueil.
async function loadOrFallback<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request
  } catch {
    return fallback
  }
}

async function loadHomeBlocks(): Promise<HomeData> {
  const lang = locale.value
  const [featured, recent, topRated, genres] = await Promise.all([
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
    loadOrFallback(api.request<{ items: GenreItem[] }>('/genres'), { items: [] }),
  ])
  return {
    featured: featured.items,
    recent: recent.items,
    topRated: topRated.items,
    genres: genres.items,
  }
}

const { data } = await useAsyncData<HomeData>(`home-${locale.value}`, loadHomeBlocks, {
  watch: [locale],
})

const searchBox = ref<{ submit: () => void } | null>(null)

// Au mobile, le champ n'a que « Rechercher… ». Choisi après le montage pour que le rendu serveur
// et le premier rendu du navigateur restent identiques.
const narrow = ref(false)
onMounted(() => {
  const query = window.matchMedia('(max-width: 767px)')
  narrow.value = query.matches
  query.addEventListener('change', (event) => {
    narrow.value = event.matches
  })
})
const placeholder = computed(() =>
  narrow.value ? t('home.searchPlaceholderShort') : t('home.searchPlaceholder'),
)

useHead({ title: () => t('app.name') })
</script>

<template>
  <div class="home">
    <section class="home__hero">
      <h1 class="home__title" data-testid="home-title">
        {{ t('home.title') }} <span class="home__highlight">{{ t('home.titleHighlight') }}</span>
      </h1>
      <p class="home__intro" data-testid="home-intro">
        <span class="home__intro-long">{{ t('home.intro') }}</span>
        <span class="home__intro-short">{{ t('home.introShort') }}</span>
      </p>
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
    </section>

    <div class="home__body">
      <HomeFeatured v-if="data?.featured.length" :works="data.featured" />

      <HomeExplore v-if="data?.genres.length" :genres="data.genres" />

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
// Bandes pleine largeur : on annule les marges de `<main>`, la page pose les siennes.
.home {
  margin: calc(-1 * var(--main-pad-top)) calc(-1 * var(--main-pad-x))
    calc(-1 * var(--main-pad-bottom));
  --rule-gap: 14px;
}

// La trame du bord droit (décor, sans clic) s'arrête au filet de la bande.
.home__hero {
  position: relative;
  padding: 22px 14px 20px;
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
    padding: 40px 40px 34px;

    &::before {
      width: 30%;
    }
  }
}

.home__title {
  color: var(--color-blue);
  font-size: 1.5rem;
  line-height: 1.1;

  @media (min-width: 768px) {
    font-size: 2.125rem;
  }
}

// Soulignement au feutre rose (bleu sur rose : 3,2:1, suffisant pour de gros caractères).
.home__highlight {
  background: linear-gradient(transparent 62%, var(--color-rose) 62%);
}

.home__intro {
  max-width: 520px;
  margin: 8px 0 18px;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

// Accroche complète au bureau, courte au mobile.
.home__intro-short {
  @media (min-width: 768px) {
    display: none;
  }
}

.home__intro-long {
  @media (max-width: 767px) {
    display: none;
  }
}

.home__search {
  display: flex;
  gap: 10px;
  max-width: 640px;
}

.home__field {
  flex: 1;
}

// Au mobile, Entrée suffit : le bouton n'existe qu'à partir de la tablette.
.home__submit {
  @media (max-width: 767px) {
    display: none;
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
