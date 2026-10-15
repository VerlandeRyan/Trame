<script setup lang="ts">
import type { RelationGroup } from '~/utils/work'
import { workSlug } from '~/utils/work'

// Œuvres liées regroupées par type de relation (inverse déduit dans `groupRelations`).
// Comme dans les maquettes : couvertures seules ; le titre reste dans le nom accessible du lien.
defineProps<{ groups: RelationGroup[] }>()
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section v-if="groups.length > 0" class="related" aria-labelledby="work-related-title">
    <h2 id="work-related-title" class="related__title">{{ t('work.related.title') }}</h2>
    <UiRule />
    <UiPanel class="related__panel">
      <div v-for="group in groups" :key="group.key" class="related__group" :data-group="group.key">
        <h3 class="related__group-title">{{ t(`relationGroup.${group.key}`) }}</h3>
        <ul class="related__list">
          <li v-for="work in group.works" :key="work.id">
            <NuxtLink
              class="related__link"
              :to="localePath(`/work/${workSlug(work.id, work.title)}`)"
              :aria-label="work.title"
              :title="work.title"
            >
              <WorkCover size="small" />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </UiPanel>
  </section>
</template>

<style scoped lang="scss">
.related__title {
  color: var(--color-ink);
  font-size: 0.9375rem;
}

.related__panel {
  display: flex;
  flex-wrap: wrap;
  row-gap: var(--space-4);
}

// Groupes côte à côte, séparés par un filet (maquettes).
.related__group {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  padding: 0 10px;
  border-left: var(--border);

  &:first-child {
    padding-left: 0;
    border-left: 0;
  }

  @media (min-width: 768px) {
    padding: 0 20px;
  }
}

.related__group-title {
  color: var(--color-ink);
  font-size: 0.6875rem;

  @media (min-width: 768px) {
    font-size: 0.75rem;
  }
}

.related__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  @media (min-width: 768px) {
    gap: 10px;
  }
}

// La couverture prend la largeur du lien : 58 px sur mobile, 72 px au bureau (maquettes).
.related__link {
  display: block;
  width: 58px;
  color: inherit;

  @media (min-width: 768px) {
    width: 72px;
  }

  :deep(.cover) {
    width: 100%;
  }
}
</style>
