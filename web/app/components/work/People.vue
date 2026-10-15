<script setup lang="ts">
import {
  isSafeLink,
  linkNetwork,
  PEOPLE_COLLAPSED_COUNT,
  type ExternalLink,
  type LinkNetwork,
} from '~/utils/work'

// « Auteur sur le web » : sites et réseaux des personnes créditées, repliés au-delà de 3 personnes.
const props = defineProps<{
  people: { personId: number; name: string; links: ExternalLink[] }[]
}>()
const { t } = useI18n()

const isExpanded = ref(false)
const visiblePeople = computed(() =>
  isExpanded.value ? props.people : props.people.slice(0, PEOPLE_COLLAPSED_COUNT),
)
const hiddenCount = computed(() => props.people.length - PEOPLE_COLLAPSED_COUNT)

// Noms écrits en toutes lettres : l'analyse de @nuxt/icon les embarque aussi côté navigateur.
const NETWORK_ICONS: Record<LinkNetwork, string> = {
  x: 'tabler:brand-x',
  instagram: 'tabler:brand-instagram',
  youtube: 'tabler:brand-youtube',
  tiktok: 'tabler:brand-tiktok',
  facebook: 'tabler:brand-facebook',
  bluesky: 'tabler:brand-bluesky',
  twitch: 'tabler:brand-twitch',
  discord: 'tabler:brand-discord',
  patreon: 'tabler:brand-patreon',
  tumblr: 'tabler:brand-tumblr',
  pixiv: 'tabler:brand-pixiv',
  website: 'tabler:world',
}

const iconFor = (url: string) => NETWORK_ICONS[linkNetwork(url)]

const safeLinks = (links: ExternalLink[]) => links.filter((link) => isSafeLink(link.url))
</script>

<template>
  <section v-if="people.length > 0" class="people" aria-labelledby="work-people-title">
    <h2 id="work-people-title" class="people__title">
      {{ t('work.people.title', props.people.length) }}
    </h2>
    <UiRule class="people__rule" />
    <ul class="people__list">
      <li v-for="person in visiblePeople" :key="person.personId" class="people__item">
        <span class="people__name">{{ person.name }}</span>
        <span class="people__links">
          <a
            v-for="link in safeLinks(person.links)"
            :key="link.url"
            :href="link.url"
            rel="noopener noreferrer"
            target="_blank"
            class="people__link"
            :aria-label="`${person.name} : ${link.label ?? link.url}`"
          >
            <Icon :name="iconFor(link.url)" aria-hidden="true" />
          </a>
        </span>
      </li>
    </ul>
    <div v-if="hiddenCount > 0" class="people__more">
      <span v-if="!isExpanded" class="people__more-label">
        {{ t('work.people.more', { count: hiddenCount }) }}
      </span>
      <button
        type="button"
        class="people__toggle"
        :aria-expanded="isExpanded"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? t('work.people.collapse') : t('work.people.showAll') }}
        <Icon
          :name="isExpanded ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'"
          size="10"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Même traitement que « Informations » : trame fondue au mobile, filet plein de 2 px au bureau.
.people__title {
  color: var(--color-ink);
  font-size: 0.9375rem;

  @media (min-width: 768px) {
    margin-top: var(--space-1);
    padding-bottom: var(--space-1);
    border-bottom: var(--border);
    font-size: 0.75rem;
  }
}

.people__rule {
  --rule-gap: 2px;

  @media (min-width: 768px) {
    display: none;
  }
}

.people__list {
  @media (min-width: 768px) {
    margin-top: 6px;
  }
}

.people__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 28px;
  border-bottom: 1px dashed var(--color-rule);
  font-size: 0.75rem;
}

.people__name {
  color: var(--color-ink-soft);
}

.people__links {
  display: flex;
  gap: var(--space-1);
}

// Zone tactile de 44 px sans agrandir la ligne : la marge négative la fait déborder au-dessus
// et au-dessous de l'icône.
.people__link {
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  margin-block: -8px;
  color: var(--color-ink);
}

.people__more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 28px;
  border-bottom: 1px dashed var(--color-rule);
  font-size: 0.75rem;
}

.people__more-label {
  color: var(--color-ink);
  font-weight: 700;
}

.people__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--touch);
  margin-block: -8px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  cursor: pointer;
}
</style>
