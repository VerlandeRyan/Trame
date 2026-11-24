<script setup lang="ts">
import { adminEditPath, type AdminKind } from '~/utils/admin'
import type { AdminNamesakes } from '~/contract/api'

/**
 * Name field of a record (the slot) followed by a notice that lists the records already bearing
 * that name, drafts and archives included. It only informs: saving is never blocked.
 */
const props = defineProps<{
  kind: AdminKind
  /** Name or title typed so far. */
  name: string
  /** Record being edited, which is not its own namesake. */
  recordId?: number
  /** Replaces the administration API lookup (the gallery shows the notice without a server). */
  lookup?: (name: string) => Promise<AdminNamesakes>
}>()
const { t } = useI18n()
const localePath = useLocalePath()
const client = useAdminClient()

/** Pause after the last keystroke before looking for namesakes. */
const TYPING_PAUSE_MS = 300
/** The last answer, with the name it answers. */
const found = ref<AdminNamesakes & { name: string }>({ name: '', items: [], hasMore: false })
/** Comparison form of a name, as the API reads it (case and runs of spaces ignored). */
const sameName = (first: string, second: string) =>
  first.trim().replaceAll(/\s+/g, ' ').toLowerCase() ===
  second.trim().replaceAll(/\s+/g, ' ').toLowerCase()
// Hidden once the name really moves on; a change of case or spacing keeps it, so it does not flicker.
const isShown = computed(
  () => found.value.items.length > 0 && sameName(props.name, found.value.name),
)
/** What the field is called: a work has a title, the others a name. */
const field = computed(() =>
  t(props.kind === 'works' ? 'admin.namesake.title' : 'admin.namesake.name'),
)
const sentence = computed(() =>
  t(
    found.value.items.length > 1 || found.value.hasMore
      ? 'admin.namesake.many'
      : 'admin.namesake.one',
    { field: field.value },
  ),
)
let timer: ReturnType<typeof setTimeout> | undefined
let latestLookup = 0

/** Looks for namesakes of `name`; an answer older than a newer lookup is dropped. */
async function lookUp(name: string) {
  const current = ++latestLookup
  let answer: AdminNamesakes = { items: [], hasMore: false }
  if (name.trim() !== '') {
    try {
      answer = await (props.lookup?.(name) ?? client.namesakes(props.kind, name, props.recordId))
    } catch {
      // The notice is advisory: a failed lookup shows nothing and must not get in the way of the form.
    }
  }
  if (current === latestLookup) found.value = { ...answer, name }
}

/** Schedules a lookup once typing pauses. */
function scheduleLookUp(name: string) {
  clearTimeout(timer)
  timer = setTimeout(() => void lookUp(name), TYPING_PAUSE_MS)
}

// Browser only: the notice follows what is typed, and an opened record is checked as it loads.
onMounted(() => {
  scheduleLookUp(props.name)
  watch(
    () => [props.kind, props.name, props.recordId],
    () => scheduleLookUp(props.name),
  )
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div>
    <slot />
    <!-- Live region holding only the sentence (phrasing content): the list below is not announced. -->
    <output class="sr-only" data-testid="namesake-announcement">{{
      isShown ? sentence : ''
    }}</output>
    <div v-if="isShown" class="namesake__notice" data-testid="namesake-notice">
      <Icon name="tabler:info-circle" size="20" aria-hidden="true" />
      <div>
        <p class="namesake__text" aria-hidden="true">{{ sentence }}</p>
        <ul class="namesake__list">
          <li v-for="namesake in found.items" :key="namesake.id" class="namesake__item">
            <NuxtLink
              :to="localePath(adminEditPath(kind, namesake.id))"
              target="_blank"
              rel="noopener"
              class="link-underlined"
              :aria-label="t('admin.draftReferences.open', { name: namesake.name })"
            >
              {{ namesake.name }}
              <Icon name="tabler:external-link" size="16" aria-hidden="true" />
            </NuxtLink>
            <UiDraftBadge v-if="namesake.lifecycle === 'draft'">{{
              t('admin.draft')
            }}</UiDraftBadge>
            <UiStateBadge v-else :state="namesake.lifecycle">
              {{ t(`admin.${namesake.lifecycle}`) }}
            </UiStateBadge>
          </li>
        </ul>
        <p v-if="found.hasMore" class="namesake__more" data-testid="namesake-more">
          {{ t('admin.namesake.more', { field }) }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.namesake__notice {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: var(--border);
  // Dotted and transparent: a solid white frame reads as a field to fill in.
  border-style: dotted;
  border-radius: var(--radius);
}

.namesake__text {
  margin: 0 0 var(--space-1);
  font-size: 0.875rem;
  font-weight: 700;
}

.namesake__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
}

.namesake__item {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  font-size: 0.875rem;
}

.namesake__more {
  margin: var(--space-1) 0 0;
  font-size: 0.875rem;
}
</style>
