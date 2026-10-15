<script setup lang="ts">
import { originalLine, translatedCode, type WorkSummary } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

const props = defineProps<{ work: WorkSummary }>()
const { t, te, locale } = useI18n()
const localePath = useLocalePath()

const path = computed(() => localePath(`/work/${workSlug(props.work.id, props.work.title)}`))
// « EN : Titre original » quand la langue de l'interface n'est pas celle de l'œuvre.
const original = computed(() => {
  const line = originalLine(props.work, locale.value)
  return line === null ? null : `${line.language.toUpperCase()} : ${line.title}`
})
const tags = computed(() => [
  t(`workType.${props.work.type}`),
  ...props.work.formats.map((code) => translatedCode(t, te, 'genre', code)),
])
const authorLine = computed(() =>
  [props.work.mainAuthor, t(`workStatus.${props.work.status}`)].filter(Boolean).join(' · '),
)
</script>

<template>
  <article class="result" data-testid="search-result">
    <NuxtLink :to="path" class="result__cover" tabindex="-1" aria-hidden="true">
      <WorkCover :url="coverUrl(work.coverPath)" size="small" />
    </NuxtLink>
    <div class="result__body">
      <h3 class="result__title">
        <NuxtLink :to="path" class="result__link">{{ work.title }}</NuxtLink>
      </h3>
      <p v-if="original" class="result__original" data-testid="result-original">{{ original }}</p>
      <ul class="result__tags">
        <li v-for="tag in tags" :key="tag">
          <UiChip class="result__tag">{{ tag }}</UiChip>
        </li>
      </ul>
      <p class="result__meta">{{ authorLine }}</p>
    </div>
    <!-- Inactif jusqu'à « Ajouter à ma liste » (#23). -->
    <div class="result__action">
      <UiButton
        variant="primary"
        size="small"
        disabled
        class="result__add"
        :aria-label="t('search.addTo', { title: work.title })"
      >
        <span class="result__add-label">{{ t('search.add') }}</span>
        <Icon name="tabler:plus" size="14" aria-hidden="true" />
      </UiButton>
    </div>
  </article>
</template>

<style scoped lang="scss">
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;

  @media (min-width: 768px) {
    gap: 14px;
  }
}

.result__cover {
  display: block;
  flex: none;
}

.result__cover :deep(.cover) {
  width: 40px;

  @media (min-width: 768px) {
    width: 56px;
  }
}

.result__body {
  flex: 1;
  min-width: 0;
}

.result__title {
  margin-bottom: 8px;
  font-size: 1.0625rem;
  font-weight: 800;
}

.result__link {
  color: var(--color-blue);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.result__original {
  margin: -6px 0 5px;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.result__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
}

.result__tags .result__tag {
  padding: 0 8px;
  font-size: 0.8125rem;
}

.result__meta {
  margin: 5px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.result__action {
  flex: none;
}

.result__add {
  min-height: 36px;
  padding: 0 10px;
  font-size: 0.875rem;

  @media (min-width: 768px) {
    padding: 0 10px;
  }
}

// Mobile : « + » seul, le libellé reste dans `aria-label`.
.result__add-label {
  display: none;

  @media (min-width: 768px) {
    display: inline;
  }
}
</style>
