<script setup lang="ts">
import { formatTotal, type WorkStatus, type WorkType } from '~/utils/work'

// Bloc « Informations » : type, format, totaux (« ? » tant que l'œuvre est en cours), statut, éditeurs, langue.
const props = defineProps<{
  type: WorkType
  formats: string[]
  /** Totaux : `null` tant qu'ils ne sont pas renseignés (affichés « ? »). */
  totals: { chapters: number | null; volumes: number | null }
  status: WorkStatus
  publishers: string[]
  originalLanguage: string
}>()
const { t, te, locale } = useI18n()

// Repliable sur mobile uniquement ; ouvert par défaut. Au bureau la liste reste toujours affichée.
const isOpen = ref(true)
const listId = useId()

const codeLabel = (group: 'genre', code: string) =>
  te(`${group}.${code}`) ? t(`${group}.${code}`) : code

const languageName = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' }).of(props.originalLanguage)
  } catch {
    return undefined
  }
})

const rows = computed(() => {
  const list: { key: string; label: string; value: string }[] = [
    { key: 'type', label: t('work.info.type'), value: t(`workType.${props.type}`) },
  ]
  if (props.formats.length > 0) {
    list.push({
      key: 'format',
      label: t('work.info.format'),
      value: props.formats.map((code) => codeLabel('genre', code)).join(', '),
    })
  }
  list.push(
    { key: 'chapters', label: t('work.info.chapters'), value: formatTotal(props.totals.chapters) },
    { key: 'volumes', label: t('work.info.volumes'), value: formatTotal(props.totals.volumes) },
    { key: 'status', label: t('work.info.status'), value: t(`workStatus.${props.status}`) },
  )
  if (props.publishers.length > 0) {
    list.push({
      key: 'publisher',
      label: t('work.info.publisher'),
      value: props.publishers.join(', '),
    })
  }
  list.push({
    key: 'language',
    label: t('work.info.language'),
    value: languageName.value ?? props.originalLanguage,
  })
  return list
})
</script>

<template>
  <section class="info" :class="{ 'info--collapsed': !isOpen }" :aria-label="t('work.info.title')">
    <!-- Bureau : titre simple (maquette 01). Mobile : le titre est un bouton qui replie la liste. -->
    <h2 class="info__title info__title--static">{{ t('work.info.title') }}</h2>
    <h2 class="info__title info__title--toggle">
      <button
        type="button"
        class="info__toggle"
        :aria-expanded="isOpen"
        :aria-controls="listId"
        @click="isOpen = !isOpen"
      >
        {{ t('work.info.title') }}
        <Icon
          name="tabler:chevron-down"
          size="14"
          aria-hidden="true"
          class="info__chevron"
          :class="{ 'info__chevron--closed': !isOpen }"
        />
      </button>
    </h2>
    <UiRule class="info__rule" />
    <dl :id="listId" class="info__list">
      <div v-for="row in rows" :key="row.key" class="info__row">
        <dt>{{ row.label }}</dt>
        <dd :data-testid="`work-info-${row.key}`">{{ row.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped lang="scss">
// Mobile : titre 15 px sous une trame fondue. Bureau (maquette 01) : titre de 12 px souligné
// d'un filet plein de 2 px, sans trame.
.info__title {
  color: var(--color-ink);
  font-size: 0.9375rem;
}

.info__title--static {
  display: none;
}

.info__toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.info__chevron--closed {
  transform: rotate(-90deg);
}

@media (prefers-reduced-motion: no-preference) {
  .info__chevron {
    transition: transform 0.15s;
  }
}

.info--collapsed .info__list {
  display: none;
}

@media (min-width: 768px) {
  .info__title--toggle {
    display: none;
  }

  .info__title--static {
    display: block;
    margin-top: var(--space-1);
    padding-bottom: var(--space-1);
    border-bottom: var(--border);
    font-size: 0.75rem;
  }

  // Au bureau la liste est toujours visible, quel que soit l'état mobile.
  .info--collapsed .info__list {
    display: grid;
  }
}

.info__rule {
  --rule-gap: 2px;

  @media (min-width: 768px) {
    display: none;
  }
}

.info__list {
  display: grid;
  margin-top: 0;

  @media (min-width: 768px) {
    margin-top: 6px;
  }
}

.info__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 5px 0;
  border-bottom: 1px dashed var(--color-rule);
  font-size: 0.75rem;

  dt {
    color: var(--color-ink-soft);
  }

  dd {
    font-weight: 700;
    text-align: right;
  }
}
</style>
