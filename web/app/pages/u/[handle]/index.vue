<script setup lang="ts">
import type { ApiError } from '~/utils/api-error'
import {
  monogram,
  PROFILE_STATUS_ORDER,
  statusShares,
  updateAge,
  updateProgress,
  type Profile,
  type ProfileUpdate,
  type ProfileVisibility,
} from '~/utils/profile'
import { coverUrl, workSlug } from '~/utils/work'

// Profil public d'un membre : `/u/{handle}` (US-08, maquettes 11 à 13).
const route = useRoute()
const { t, n, locale } = useI18n()
const localePath = useLocalePath()
const api = useApi()
const auth = useAuth()
const cookieHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const handle = String(route.params.handle ?? '')
const profileKey = `profile-${handle}-${locale.value}-${auth.state.value.status}`

async function loadProfile(): Promise<Profile> {
  try {
    return await api.request<Profile>(`/users/${encodeURIComponent(handle)}`, {
      query: { lang: locale.value },
      headers: cookieHeaders,
    })
  } catch (cause) {
    const { status } = cause as ApiError
    throw createError({ statusCode: status === 404 || status === 400 ? 404 : 500, fatal: true })
  }
}

const { data: profile, error } = await useAsyncData(profileKey, loadProfile)
if (error.value || !profile.value) {
  throw createError({ statusCode: error.value?.status ?? 404, fatal: true })
}

const shownHandle = computed(() => profile.value?.handle ?? handle)
const details = computed(() => profile.value?.details ?? null)
const isOwner = computed(() => profile.value?.isOwner === true)
const shares = computed(() => (details.value ? statusShares(details.value.stats.statusCounts) : []))
// Son propre profil mène à « Ma liste de lecture » (modifiable), celui d'un autre à sa liste en lecture seule.
const listPath = computed(() =>
  localePath(isOwner.value ? '/list' : `/u/${shownHandle.value}/list`),
)

// Un profil privé ne doit pas être indexé ; un profil public l'est, avec sa description.
const isPublic = computed(() => profile.value?.visibility === 'public')
useSeoMeta({
  title: () => t('profile.title', { handle: shownHandle.value }),
  description: () => t('profile.seoDescription', { handle: shownHandle.value }),
  robots: () => (isPublic.value ? 'index, follow' : 'noindex, nofollow'),
})
const localeHead = useLocaleHead({ dir: false, seo: true })
useHead(() => ({ link: localeHead.value.link, meta: localeHead.value.meta }))

const memberSince = computed(() =>
  details.value
    ? new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long' }).format(
        new Date(details.value.memberSince),
      )
    : '',
)
const ratingAverage = computed(() => {
  const average = details.value?.stats.ratingAverage ?? null
  if (average === null) return t('profile.noRating')
  const value = new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1 }).format(average)
  return t('profile.ratingAverageValue', { value })
})

const workPath = (work: { id: number; title: string }) =>
  localePath(`/work/${workSlug(work.id, work.title)}`)

function progressLabel(update: ProfileUpdate): string {
  const progress = updateProgress(update.entry)
  if (progress.kind !== 'completed') return t(`profile.${progress.kind}`, { value: progress.value })
  return progress.rating === null
    ? t('profile.completed')
    : t('profile.completedRated', { rating: progress.rating })
}

function ageLabel(update: ProfileUpdate): string {
  const age = updateAge(update.updatedAt)
  return 'count' in age
    ? t(`profile.age.${age.unit}`, { count: age.count })
    : t(`profile.age.${age.unit}`)
}

// Réglage de la visibilité (propriétaire) : l'affichage suit l'enregistrement.
const visibilityErrorKey = ref<string | null>(null)
const isSavingVisibility = ref(false)
async function changeVisibility(visibility: ProfileVisibility) {
  if (!profile.value || isSavingVisibility.value) return
  isSavingVisibility.value = true
  visibilityErrorKey.value = null
  try {
    await api.request('/me/profile', { method: 'PATCH', body: { visibility } })
    await refreshNuxtData(profileKey)
  } catch {
    visibilityErrorKey.value = 'profile.visibility.error'
  } finally {
    isSavingVisibility.value = false
  }
}

// Lien de partage de son propre profil ; sans accès au presse-papiers, rien n'est annoncé.
const isLinkCopied = ref(false)
async function copyProfileLink() {
  try {
    await navigator.clipboard.writeText(new URL(route.path, window.location.origin).href)
    isLinkCopied.value = true
  } catch {
    isLinkCopied.value = false
  }
}
const nextVisibility = computed<ProfileVisibility>(() => (isPublic.value ? 'private' : 'public'))
</script>

<template>
  <div class="profile" data-testid="profile">
    <aside class="profile__side">
      <header class="profile__identity">
        <div class="profile__monogram" aria-hidden="true">
          <span class="profile__monogram-letters">{{ monogram(shownHandle) }}</span>
        </div>
        <div class="profile__who">
          <h1 class="profile__handle" data-testid="profile-handle">@{{ shownHandle }}</h1>
          <p v-if="details" class="profile__since">
            {{ t('profile.memberSince', { date: memberSince }) }}
          </p>
        </div>
      </header>

      <div v-if="isOwner" class="profile__visibility" data-testid="profile-visibility">
        <p class="profile__visibility-state">
          <Icon :name="isPublic ? 'tabler:eye' : 'tabler:eye-off'" size="16" aria-hidden="true" />
          {{ t(isPublic ? 'profile.visibility.public' : 'profile.visibility.private') }}
        </p>
        <button
          type="button"
          class="profile__link-button"
          :disabled="isSavingVisibility"
          data-testid="profile-visibility-toggle"
          @click="changeVisibility(nextVisibility)"
        >
          {{ t(isPublic ? 'profile.visibility.makePrivate' : 'profile.visibility.makePublic') }}
        </button>
        <button
          v-if="isPublic"
          type="button"
          class="profile__link-button profile__copy-link"
          data-testid="profile-copy-link"
          @click="copyProfileLink"
        >
          {{ t(isLinkCopied ? 'profile.linkCopied' : 'profile.copyLink') }}
        </button>
        <p v-if="visibilityErrorKey" class="profile__error" role="alert">
          {{ t(visibilityErrorKey) }}
        </p>
      </div>

      <section v-if="details" class="profile__stats" :aria-label="t('profile.stats')">
        <h2 class="profile__label">{{ t('profile.stats') }}</h2>
        <dl class="profile__totals">
          <div class="profile__total" data-testid="profile-chapters">
            <dt>{{ t('profile.chaptersRead') }}</dt>
            <dd>{{ n(details.stats.chaptersRead) }}</dd>
          </div>
          <div class="profile__total" data-testid="profile-volumes">
            <dt>{{ t('profile.volumesRead') }}</dt>
            <dd>{{ n(details.stats.volumesRead) }}</dd>
          </div>
        </dl>
        <dl class="profile__figures">
          <div class="profile__figure">
            <dt>{{ t('profile.worksFollowed') }}</dt>
            <dd data-testid="profile-followed">{{ n(details.stats.worksFollowed) }}</dd>
          </div>
          <div class="profile__figure">
            <dt>{{ t('profile.ratingAverage') }}</dt>
            <dd data-testid="profile-average">{{ ratingAverage }}</dd>
          </div>
        </dl>
        <!-- Décor : la légende juste dessous donne les mêmes chiffres, lisibles au clavier et au lecteur d'écran. -->
        <div v-if="shares.length" class="profile__bar" aria-hidden="true">
          <span
            v-for="share in shares"
            :key="share.status"
            class="profile__bar-part"
            :style="{ flexGrow: share.count, background: `var(--status-${share.status})` }"
          />
        </div>
        <ul class="profile__statuses">
          <li
            v-for="status in PROFILE_STATUS_ORDER"
            :key="status"
            class="profile__status-item"
            :class="{ 'profile__status-item--empty': details.stats.statusCounts[status] === 0 }"
          >
            <NuxtLink
              :to="{ path: listPath, query: { status } }"
              class="profile__status"
              :data-testid="`profile-status-${status}`"
            >
              <span
                class="profile__dot"
                :style="{ background: `var(--status-${status})` }"
                aria-hidden="true"
              />
              <span class="profile__status-label">{{ t(`profile.statuses.${status}`) }}</span>
              <span class="profile__status-count">{{ details.stats.statusCounts[status] }}</span>
            </NuxtLink>
          </li>
        </ul>
        <UiButton :href="listPath" block data-testid="profile-list-link">
          {{ t(isOwner ? 'profile.openMyList' : 'profile.seeList') }}
        </UiButton>
      </section>
    </aside>

    <UiPanel v-if="!details" class="profile__private" data-testid="profile-private">
      <span class="profile__lock"><Icon name="tabler:lock" size="28" aria-hidden="true" /></span>
      <h2 class="profile__private-title">{{ t('profile.private.title') }}</h2>
      <p class="profile__private-text">{{ t('profile.private.text') }}</p>
    </UiPanel>

    <div v-else class="profile__main">
      <section class="profile__section" data-testid="profile-recent">
        <h2 class="profile__heading">{{ t('profile.recent') }}</h2>
        <UiRule />
        <p v-if="!details.recentUpdates.length" class="profile__empty">
          {{ t('profile.noRecent') }}
        </p>
        <UiPanel v-else class="profile__updates">
          <article
            v-for="update in details.recentUpdates"
            :key="update.work.id"
            class="profile__update"
          >
            <NuxtLink
              :to="workPath(update.work)"
              class="profile__update-cover"
              tabindex="-1"
              aria-hidden="true"
            >
              <WorkCover :url="coverUrl(update.work.coverPath)" size="small" />
            </NuxtLink>
            <div class="profile__update-text">
              <NuxtLink :to="workPath(update.work)" class="profile__work">
                {{ update.work.title }}
              </NuxtLink>
              <p class="profile__update-line">
                <span
                  class="profile__badge"
                  :style="{ background: `var(--status-${update.entry.status})` }"
                >
                  {{ t(`readingStatus.${update.entry.status}`) }}
                </span>
                <span class="profile__progress">{{ progressLabel(update) }}</span>
              </p>
            </div>
            <time class="profile__age" :datetime="update.updatedAt">{{ ageLabel(update) }}</time>
          </article>
        </UiPanel>
      </section>

      <section class="profile__section" data-testid="profile-top-rated">
        <h2 class="profile__heading">{{ t('profile.topRated') }}</h2>
        <UiRule />
        <p v-if="!details.topRated.length" class="profile__empty">{{ t('profile.noTopRated') }}</p>
        <ul v-else class="profile__shelf">
          <li v-for="rated in details.topRated" :key="rated.work.id" class="profile__rated">
            <NuxtLink :to="workPath(rated.work)" class="profile__rated-link">
              <WorkCover :url="coverUrl(rated.work.coverPath)" />
              <span class="profile__work">{{ rated.work.title }}</span>
            </NuxtLink>
            <span class="profile__rating">
              {{ t('profile.ratingOutOf', { rating: rated.rating }) }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Maquettes 11 (bureau) et 12 (mobile) : colonne d'identité à gauche au bureau, tout en une colonne
// au mobile (monogramme à côté du pseudo, statistiques réduites aux totaux et à la barre).
.profile {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-6);

  @media (min-width: 768px) {
    grid-template-columns: 17.5rem minmax(0, 1fr);
    align-items: start;
    gap: var(--space-6);
  }
}

.profile__side {
  display: grid;
  gap: var(--space-3);
  min-width: 0;

  @media (min-width: 768px) {
    gap: var(--space-4);
  }
}

.profile__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  @media (min-width: 768px) {
    display: grid;
    align-items: start;
    gap: var(--space-3);
  }
}

.profile__monogram {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 4.5rem;
  aspect-ratio: 1;
  overflow: hidden;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background-color: var(--color-cover-blank);

  &::before {
    @include screentone(var(--color-rose-vivid), 7px, 150deg);
  }

  @media (min-width: 768px) {
    width: 100%;
    &::before {
      @include screentone(var(--color-rose-vivid), 9px, 150deg);
    }
  }
}

.profile__monogram-letters {
  position: relative;
  padding: 4px var(--space-2);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 800;

  @media (min-width: 768px) {
    padding: var(--space-2) var(--space-4);
    font-size: 2.25rem;
  }
}

.profile__who {
  min-width: 0;
}

.profile__handle {
  margin: 0;
  color: var(--color-blue);
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 800;
  overflow-wrap: anywhere;

  @media (min-width: 768px) {
    font-size: 1.5rem;
  }
}

.profile__since {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

// Propriétaire : état de visibilité et actions, dans un cadre en tirets (maquette 11, vue 2).
.profile__visibility {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 2px dashed var(--color-ink);
  border-radius: var(--radius);
  font-size: 0.8125rem;
}

.profile__visibility-state {
  display: flex;
  flex: 1 0 100%;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-ink-soft);
}

// Actions en ligne : 44 px de haut au doigt seulement.
.profile__link-button {
  min-height: 28px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font: inherit;
  font-weight: 800;
  text-decoration: underline;
  cursor: pointer;

  @media (pointer: coarse) {
    min-height: var(--touch);
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
}

// Colonne étroite du bureau : « Lien copié » reste sur sa propre ligne et ne fait pas remonter
// le bouton. Au mobile les deux actions partagent la rangée, pour prendre moins de hauteur.
.profile__copy-link {
  text-align: left;

  @media (min-width: 768px) {
    flex: 0 0 100%;
  }
}

.profile__error {
  margin: 0;
  color: var(--color-crimson);
  font-weight: 700;
}

.profile__stats {
  display: grid;
  gap: var(--space-3);
}

// « Statistiques » n'existe qu'au bureau, sous un filet.
.profile__label {
  display: none;
  margin: 0;
  padding-bottom: 2px;
  border-bottom: var(--border);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 800;

  @media (min-width: 768px) {
    display: block;
  }
}

.profile__totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: 0;
}

.profile__total {
  padding: var(--space-2) var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  background: var(--color-surface);

  dt {
    color: var(--color-ink-soft);
    font-size: 0.75rem;
  }

  dd {
    margin: 0;
    color: var(--color-ink);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.2;
  }
}

// Œuvres suivies et note moyenne : bureau seulement (la maquette mobile n'a que les totaux).
.profile__figures {
  display: none;
  margin: 0;

  @media (min-width: 768px) {
    display: grid;
    gap: var(--space-2);
  }
}

.profile__figure {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px dashed var(--color-rule);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;

  dd {
    margin: 0;
    color: var(--color-ink);
    font-weight: 700;
  }
}

.profile__bar {
  display: flex;
  height: 14px;
  overflow: hidden;
  border: var(--border);
  border-radius: var(--radius);
}

.profile__bar-part {
  flex-basis: 0;

  & + & {
    border-left: 2px solid var(--color-ink);
  }
}

// Mobile : légende sur une ligne, statuts à zéro masqués. Bureau : une ligne par statut, avec ›.
.profile__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--space-3);
  margin: 0;
  padding: 0;
  font-size: 0.75rem;

  @media (min-width: 768px) {
    display: grid;
    gap: 0;
    font-size: 0.875rem;
  }
}

.profile__status-item--empty {
  display: none;

  @media (min-width: 768px) {
    display: block;
  }
}

.profile__status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  color: var(--color-ink);
  text-decoration: none;

  @media (min-width: 768px) {
    gap: var(--space-2);
    min-height: 32px;
    border-bottom: 1px dashed var(--color-rule);

    &::after {
      content: '›';
      content: '›' / '';
    }
  }

  @include on-hover {
    text-decoration: underline;
  }
}

.profile__status-label {
  @media (min-width: 768px) {
    flex: 1;
  }
}

.profile__status-count {
  font-weight: 800;

  @media (max-width: 767px) {
    order: 1;
  }
}

.profile__dot {
  width: 10px;
  height: 10px;
  border: 2px solid var(--color-ink);
  border-radius: 50%;
}

.profile__main {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.profile__section {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.profile__heading {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 800;
}

.profile__empty {
  margin: 0;
  color: var(--color-ink-soft);
}

.profile__updates {
  padding: 0;
}

.profile__update {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);

  & + & {
    border-top: 1px dashed var(--color-rule);
  }
}

.profile__update-cover {
  display: block;
  flex: none;
  width: 3.25rem;

  :deep(.cover--small) {
    width: 100%;
  }
}

.profile__update-text {
  flex: 1;
  min-width: 0;
}

.profile__work {
  color: var(--color-blue);
  font-weight: 800;
  text-decoration: none;
  overflow-wrap: anywhere;

  @include on-hover {
    text-decoration: underline;
  }
}

.profile__update-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-2);
  margin: 4px 0 0;
  font-size: 0.8125rem;
}

.profile__badge {
  padding: 0 var(--space-2);
  border: 2px solid var(--color-ink);
  border-radius: var(--radius);
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.4;
}

.profile__progress::before {
  content: '·\00a0';
  color: var(--color-ink-soft);
}

.profile__age {
  flex: none;
  max-width: 5.5rem;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  text-align: right;
}

// Couvertures de 100 px (120 au bureau), alignées à gauche, sans s'étirer sur toute la largeur.
.profile__shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, 6.25rem);
  justify-content: start;
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, 7.5rem);
    gap: var(--space-4);
  }
}

.profile__rated {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: var(--space-1);
  font-size: 0.8125rem;
}

.profile__rated-link {
  display: grid;
  gap: var(--space-2);
  width: 100%;
  text-decoration: none;
}

.profile__rating {
  padding: 0 var(--space-2);
  border-radius: var(--radius);
  background: var(--color-field-soft);
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 800;
}

// Profil privé (maquette 13) : panneau haut, cadenas dans un rond.
.profile__private {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--space-2);
  min-height: 16rem;
  padding: var(--space-6) var(--space-4);
  text-align: center;

  @media (min-width: 768px) {
    min-height: 24rem;
  }
}

.profile__lock {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border: var(--border);
  border-radius: 50%;
  background: var(--color-field-soft);
  color: var(--color-ink);
}

.profile__private-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
}

.profile__private-text {
  max-width: 24rem;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
