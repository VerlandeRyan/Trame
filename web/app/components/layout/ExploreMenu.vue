<script setup lang="ts">
// Menu « Explorer » de l'en-tête : formats en cartes, genres en pastilles,
// compteurs et lien vers tout le catalogue.
import { pickExploreFacets } from '~/utils/home'
import { translatedCode, type WorkFacets } from '~/utils/search'

const open = defineModel<boolean>('open', { default: false })

const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const api = useApi()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panelId = useId()

// Compteurs chargés à la première ouverture ; un échec laisse seulement le lien vers le catalogue.
const facets = ref<Pick<WorkFacets, 'format' | 'genre'> | null>(null)
let requested = false

async function loadFacets() {
  if (requested) return
  requested = true
  try {
    facets.value = await api.request<WorkFacets>('/works/facets', { query: { lang: locale.value } })
  } catch {
    requested = false
  }
}

const explore = computed(() =>
  facets.value ? pickExploreFacets(facets.value) : { formats: [], themes: [] },
)

function label(code: string) {
  return translatedCode(t, te, 'genre', code)
}

function close({ restoreFocus = false } = {}) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

watch(open, (isOpen) => {
  if (isOpen) void loadFacets()
})

function closeOnOutsideClick(event: MouseEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) close()
}

// Échap sur le document : Safari ne donne pas le focus à un bouton cliqué.
function closeOnEscape(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') close({ restoreFocus: true })
}

// Mobile : le titre du volet replie ou déplie son contenu (le bureau n'a pas de repli).
const mobileQuery = '(max-width: 767px)'
const isMobile = ref(false)
const collapsed = ref(false)
const showContent = computed(() => !(isMobile.value && collapsed.value))
let mobileMedia: MediaQueryList | undefined

function syncMobile() {
  isMobile.value = mobileMedia?.matches ?? false
}

// Chaque ouverture repart volet déplié.
watch(open, (isOpen) => {
  if (isOpen) collapsed.value = false
})

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
  mobileMedia = window.matchMedia?.(mobileQuery)
  mobileMedia?.addEventListener('change', syncMobile)
  syncMobile()
  // Monté déjà ouvert (retour sur une page où l'état est resté ouvert) : charger les compteurs.
  if (open.value) void loadFacets()
})
onBeforeUnmount(() => {
  mobileMedia?.removeEventListener('change', syncMobile)
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})

// Un lien choisi referme le menu tout de suite (`@click="close()"`) : sur `/search` le menu est
// démonté et ne verrait plus la route changer ; ceci couvre les autres navigations.
watch(
  () => route.fullPath,
  () => close(),
)
</script>

<template>
  <div ref="root" class="explore-menu">
    <button
      ref="trigger"
      type="button"
      class="explore-menu__trigger"
      :aria-expanded="open"
      :aria-controls="panelId"
      data-testid="explore-open"
      @click="open = !open"
    >
      <Icon
        :name="open ? 'tabler:x' : 'tabler:menu-2'"
        size="22"
        aria-hidden="true"
        class="explore-menu__icon"
      />
      <span class="explore-menu__label">{{ t('home.explore.title') }}</span>
      <Icon
        name="tabler:chevron-down"
        size="14"
        aria-hidden="true"
        class="explore-menu__chevron"
        :class="{ 'explore-menu__chevron--open': open }"
      />
    </button>

    <div v-show="open" :id="panelId" class="explore-menu__panel" data-testid="explore-panel">
      <div class="explore-menu__intro">
        <button
          v-if="isMobile"
          type="button"
          class="explore-menu__title explore-menu__title--toggle"
          :aria-expanded="!collapsed"
          :aria-controls="`${panelId}-content`"
          data-testid="explore-fold"
          @click="collapsed = !collapsed"
        >
          {{ t('home.explore.title') }}
          <span aria-hidden="true">{{ collapsed ? '▾' : '▴' }}</span>
        </button>
        <p v-else class="explore-menu__title">{{ t('home.explore.title') }}</p>
        <p v-show="showContent" class="explore-menu__subtitle">{{ t('nav.exploreIntro') }}</p>
      </div>

      <div v-show="showContent" :id="`${panelId}-content`" class="explore-menu__body">
        <section v-if="explore.formats.length > 0">
          <p class="explore-menu__heading">{{ t('home.explore.formats') }}</p>
          <ul class="explore-menu__cards">
            <li v-for="item in explore.formats" :key="item.code">
              <NuxtLink
                :to="{ path: localePath('/search'), query: { format: item.code } }"
                class="explore-menu__card"
                :class="`explore-menu__card--${item.code}`"
                :data-testid="`explore-format-${item.code}`"
                @click="close()"
              >
                <span class="explore-menu__card-name">{{ label(item.code) }}</span>
                <span class="explore-menu__pill">{{ t('nav.worksCount', item.count) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section v-if="explore.themes.length > 0">
          <p class="explore-menu__heading">{{ t('home.explore.genres') }}</p>
          <ul class="explore-menu__chips">
            <li v-for="item in explore.themes" :key="item.code">
              <NuxtLink
                :to="{ path: localePath('/search'), query: { genre: item.code } }"
                class="explore-menu__chip"
                :data-testid="`explore-genre-${item.code}`"
                @click="close()"
              >
                {{ label(item.code) }}<small>{{ item.count }}</small>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>

      <NuxtLink
        v-show="showContent"
        :to="localePath('/search')"
        class="explore-menu__all"
        data-testid="explore-all-catalog"
        @click="close()"
      >
        {{ t('nav.exploreAll') }} ›
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.explore-menu {
  position: relative;
}

// Même bouton blanc que le sélecteur de langue, ouvert ou non : jamais de rose au clic.
.explore-menu__trigger {
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

// L'icône ☰ / ✕ est réservée au mobile.
.explore-menu__icon {
  display: none;
}

.explore-menu__chevron--open {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: no-preference) {
  .explore-menu__chevron {
    transition: transform 0.15s;
  }
}

// Bureau : fenêtre calée sur le bord droit du bouton.
.explore-menu__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  display: grid;
  grid-template-areas:
    'intro all'
    'body body';
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: var(--space-2) var(--space-4);
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100dvh - var(--header-height) - var(--space-4));
  overflow-y: auto;
  padding: 6px 20px 20px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-paper);
}

// Entre tablette et petit bureau, le bouton est trop près du bord gauche pour une fenêtre de
// 640 px calée dessus : elle se cale alors sur le bord droit de la fenêtre du navigateur.
@media (min-width: 768px) and (max-width: 1099px) {
  .explore-menu__panel {
    position: fixed;
    top: calc(var(--header-height) + 8px);
    right: var(--space-4);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .explore-menu__panel {
    animation: explore-menu-in 0.12s ease-out;
  }

  @keyframes explore-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
}

.explore-menu__intro {
  grid-area: intro;
}

.explore-menu__body {
  grid-area: body;
}

.explore-menu__title {
  margin: 14px 0 2px;
  line-height: 1.3;
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 800;
}

.explore-menu__subtitle {
  margin: 0 0 4px;
  font-size: 0.88rem;
}

.explore-menu__heading {
  margin: 18px 0 8px;
  color: var(--color-ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.explore-menu__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.explore-menu__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: var(--touch);
  padding: 10px 12px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-small);
  background: var(--color-field-soft);
  color: var(--color-ink);
  text-decoration: none;

  @include tilt-on-hover(null, 1.03, -1.2deg);

  &:active {
    transform: scale(0.97);
  }
}

.explore-menu__card--manga {
  background: var(--color-format-manga);
}

.explore-menu__card--manhwa {
  background: var(--color-format-manhwa);
}

.explore-menu__card--webtoon {
  background: var(--color-format-webtoon);
}

.explore-menu__card--bd {
  background: var(--color-format-bd);
}

.explore-menu__card--webcomic {
  background: var(--color-format-webcomic);
}

.explore-menu__card-name {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
}

.explore-menu__pill {
  align-self: flex-start;
  padding: 0 9px;
  border: 2px solid var(--color-ink);
  border-radius: 99px;
  background: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 800;
}

.explore-menu__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.explore-menu__chip {
  position: relative;
  display: block;
  padding: 5px 12px;
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-chip);
  color: var(--color-ink);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;

  // Zone de clic de 44 px au doigt, sans recouvrir les voisines (écart de 10 px).
  &::after {
    position: absolute;
    inset: 0;
    content: '';

    @media (pointer: coarse) {
      inset: -4px;
    }
  }

  small {
    margin-left: 4px;
    font-weight: 400;
  }

  @include tilt-on-hover(var(--color-rose-soft), 1.03, -1.2deg);

  &:active {
    background: var(--color-rose-soft);
    transform: scale(0.96);
  }
}

.explore-menu__all {
  grid-area: all;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch);
  padding: 10px 20px;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-small);
  background: var(--color-rose);
  color: var(--color-ink);
  font-weight: 800;
  text-decoration: none;

  @include tilt-on-hover(var(--color-rose-strong), 1.03, -1.2deg);

  &:active {
    background: var(--color-rose-strong);
    transform: scale(0.97);
  }
}

// Mobile : bouton ☰ à droite de l'en-tête (libellé lu par les lecteurs d'écran seulement), volet
// pleine largeur sous l'en-tête, repère de position (voir `Header.vue`), bouton « Voir tout » en bas.
@media (max-width: 767px) {
  // Le ☰ est un enfant statique de l'en-tête : il doit passer devant la trame (::before).
  .explore-menu__trigger {
    position: relative;
    z-index: 1;
    justify-content: center;
    width: var(--touch);
    padding: 0;
    box-shadow: var(--shadow-small);
  }

  .explore-menu__icon {
    display: block;
  }

  .explore-menu__chevron {
    display: none;
  }

  .explore-menu__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .explore-menu__panel {
    top: 100%;
    right: 0;
    left: 0;
    display: block;
    width: auto;
    max-height: calc(100dvh - var(--header-height));
    padding: 6px var(--space-4) 20px;
    border-inline: 0;
    border-top: 0;
    border-radius: 0;
    box-shadow: 0 6px 0 rgb(27 42 92 / 25%);
  }

  // « Explorer ▴ » : rangée de titre du volet, comme les maquettes.
  .explore-menu__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 52px;
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 2px solid var(--color-rule);
    background: none;
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: 1.05rem;
    text-align: left;
  }

  .explore-menu__title--toggle {
    cursor: pointer;
  }

  .explore-menu__subtitle {
    margin-top: var(--space-3);
  }

  .explore-menu__all {
    margin-top: 18px;
  }
}
</style>
