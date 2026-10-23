<script setup lang="ts">
import type { ApiError } from '~/utils/api-error'
import type { LibraryStatus } from '~/utils/library'
import {
  buildJsonLd,
  coverUrl,
  formatAlternativeTitles,
  groupRelations,
  metaDescription,
  parseWorkId,
  serializeJsonLd,
  workSlug,
  type WorkDetail,
} from '~/utils/work'

// Fiche œuvre : `/work/{id}-{slug}` (`/en/work/…` en anglais)
const route = useRoute()
const { t, te, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const api = useApi()

const workId = parseWorkId(String(route.params.slug ?? ''))
if (workId === null) throw createError({ statusCode: 404, fatal: true })

async function loadWork(): Promise<WorkDetail> {
  try {
    return await api.request<WorkDetail>(`/works/${workId}`, { query: { lang: locale.value } })
  } catch (cause) {
    const { status } = cause as ApiError
    throw createError({ statusCode: status === 404 ? 404 : 500, fatal: true })
  }
}

const { data: work, error } = await useAsyncData(`work-${workId}-${locale.value}`, loadWork)
if (error.value || !work.value) {
  throw createError({ statusCode: error.value?.status ?? 404, fatal: true })
}

// L'URL canonique porte le titre affiché dans la langue de l'interface, comme les liens des œuvres
// liées (même titre localisé) : un clic depuis une fiche arrive donc directement sur la bonne URL.
const canonicalSlug = workSlug(work.value.id, work.value.title)
const canonicalPath = localePath(`/work/${canonicalSlug}`)
if (route.params.slug !== canonicalSlug) {
  if (import.meta.server) {
    await navigateTo(canonicalPath, { redirectCode: 301 })
  } else {
    const router = useRouter()
    onMounted(() => router.replace(canonicalPath))
  }
}

const detail = work.value
const baseUrl = String(config.public.i18n?.baseUrl ?? '').replace(/\/$/, '')
const pageUrl = `${baseUrl}${canonicalPath}`
const description = metaDescription(
  detail.synopsis,
  t('work.seo.fallback', { title: detail.title }),
)
const cover = coverUrl(detail.coverPath)
const absoluteCover = cover?.startsWith('/') ? `${baseUrl}${cover}` : cover

const localeHead = useLocaleHead({ dir: false, seo: true })
useHead(() => ({
  link: localeHead.value.link,
  meta: localeHead.value.meta,
  script: [
    {
      type: 'application/ld+json',
      innerHTML: serializeJsonLd(buildJsonLd(detail, pageUrl, description)),
    },
  ],
}))
useSeoMeta({
  title: `${detail.title} · ${t('app.name')}`,
  description,
  ogTitle: detail.title,
  ogDescription: description,
  ogType: 'book',
  ogImage: absoluteCover,
  twitterCard: absoluteCover ? 'summary_large_image' : 'summary',
  twitterTitle: detail.title,
  twitterDescription: description,
})

const codeLabel = (code: string) => (te(`genre.${code}`) ? t(`genre.${code}`) : code)
const tags = [...detail.formats, ...detail.genres].map((code) => ({ code, label: codeLabel(code) }))
const alternativeTitles = formatAlternativeTitles(detail.alternativeTitles)
const relationGroups = groupRelations(detail.relations)

// Ma liste de lecture : lue dès le rendu serveur (cookie du visiteur), pour que la page arrive
// dans le bon état. Au navigateur, on relit à l'arrivée par un lien du site, ou si le serveur
// n'a pas pu lire (la page affichée au chargement a déjà l'état reçu du serveur).
const { state: auth } = useAuth()
const isSignedIn = computed(() => auth.value.status === 'authenticated')
const library = useLibraryEntry(workId)
const { entry, isLoaded, isBusy, errorKey } = library
// Passer en « Terminé » avec des compteurs sous le total paru propose de les y mettre.
const {
  isOpen: isAskingToRead,
  title: promptTitle,
  text: promptText,
  confirmLabel: promptConfirmLabel,
  cancelLabel: promptCancelLabel,
  request: requestPrompt,
  confirm: confirmPrompt,
  decline: declinePrompt,
} = useReadingPrompt()
function changeStatus(status: LibraryStatus) {
  const isAsking =
    entry.value !== null &&
    requestPrompt(
      entry.value,
      { chapters: detail.chapters, volumes: detail.volumes },
      { status },
      { apply: (changes) => library.save(changes), discard: () => undefined },
    )
  if (!isAsking) void library.save({ status })
}
const isClientNavigation = import.meta.client && !useNuxtApp().isHydrating
async function loadEntryOnServer() {
  if (import.meta.server && isSignedIn.value) await library.load()
}
await loadEntryOnServer()
onMounted(() => {
  if (isSignedIn.value && (isClientNavigation || !isLoaded.value)) library.load()
})
</script>

<template>
  <article class="work">
    <!-- Colonne de gauche au bureau ; sur mobile, les wrappers disparaissent (display: contents) et
         les blocs s'enchaînent dans l'ordre de la maquette grâce à `order`. -->
    <div class="work__side">
      <WorkCover class="work__cover" :url="cover" />
      <LibraryStatusMenu
        class="work__status"
        :entry="entry"
        :is-signed-in="isSignedIn"
        :is-loaded="isLoaded"
        :is-busy="isBusy"
        :error-key="errorKey"
        @add="library.save({})"
        @change-status="changeStatus"
        @remove="library.remove()"
      />
      <WorkActions class="work__actions" :links="detail.links" />
      <WorkInfo
        class="work__info"
        :type="detail.type"
        :formats="detail.formats"
        :totals="{ chapters: detail.chapters, volumes: detail.volumes }"
        :status="detail.status"
        :publishers="detail.publishers.map((publisher) => publisher.name)"
        :original-language="detail.originalLanguage"
      />
      <WorkPeople class="work__people" :people="detail.credits" />
    </div>

    <div class="work__main">
      <header class="work__header">
        <h1 class="work__title" data-testid="work-title">{{ detail.title }}</h1>
        <p v-if="alternativeTitles" class="work__alternatives" data-testid="work-alternatives">
          {{ alternativeTitles }}
        </p>
        <ul v-if="tags.length > 0" class="work__tags" data-testid="work-tags">
          <li v-for="tag in tags" :key="tag.code">
            <UiChip>{{ tag.label }}</UiChip>
          </li>
        </ul>
      </header>

      <WorkRating
        class="work__rating"
        :average="detail.ratingAverage"
        :rating-count="detail.ratingCount"
        :member-count="detail.memberCount"
      />
      <LibraryProgress
        v-if="entry"
        class="work__progress"
        :entry="entry"
        :total-chapters="detail.chapters"
        :total-volumes="detail.volumes"
        @change="library.save($event)"
      />
      <WorkSynopsis
        class="work__synopsis"
        :text="detail.synopsis"
        :language="detail.synopsisLanguage"
        :source="detail.synopsisSource"
        :credits="detail.credits"
      />
      <WorkRelated class="work__related" :groups="relationGroups" />
    </div>

    <UiConfirm
      v-model="isAskingToRead"
      :title="promptTitle"
      :text="promptText"
      :confirm-label="promptConfirmLabel"
      :cancel-label="promptCancelLabel"
      :close-label="t('action.close')"
      @confirm="confirmPrompt"
      @cancel="declinePrompt"
    />
  </article>
</template>

<style scoped lang="scss">
// Mobile (maquette 02) : couverture à gauche du titre, puis les blocs sur toute la largeur.
.work {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  column-gap: 14px;
  row-gap: var(--space-4);
}

.work__side,
.work__main {
  display: contents;
}

.work__cover {
  order: 1;
}

.work__header {
  order: 2;
  display: grid;
  align-content: start;
  gap: var(--space-2);
  min-width: 0;
}

// Mobile (maquette 02) : le bouton de statut, « Lire / Acheter », puis « Ma progression » avant la note.
.work__status {
  order: 3;
}

.work__actions {
  order: 4;
}

.work__progress {
  order: 5;
}

.work__rating {
  order: 6;
}

.work__synopsis {
  order: 7;
}

.work__info {
  order: 8;
}

.work__related {
  order: 9;
}

.work__people {
  order: 10;
}

.work__status,
.work__actions,
.work__progress,
.work__rating,
.work__synopsis,
.work__info,
.work__related,
.work__people {
  grid-column: 1 / -1;
}

.work__title {
  color: var(--color-blue);
  font-size: 1.5rem;
  font-weight: var(--weight-title);
  overflow-wrap: anywhere;
}

.work__alternatives {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
}

.work__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

// Bureau (maquette 01) : colonne de gauche de 210 px, contenu à droite.
@media (min-width: 768px) {
  .work {
    grid-template-columns: 210px minmax(0, 1fr);
    column-gap: var(--space-8);
    align-items: start;
  }

  .work__side,
  .work__main {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .work__cover,
  .work__header,
  .work__status,
  .work__actions,
  .work__progress,
  .work__rating,
  .work__synopsis,
  .work__info,
  .work__related,
  .work__people {
    order: 0;
    grid-column: auto;
  }

  .work__title {
    font-size: 2.125rem;
  }

  .work__alternatives {
    font-size: 0.75rem;
  }
}
</style>
