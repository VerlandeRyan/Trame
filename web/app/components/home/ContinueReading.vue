<script setup lang="ts">
import { CONTINUE_READING_SIZE, incrementUnit } from '~/utils/home'
import { formatProgress, unitProgress, type ListedEntry } from '~/utils/reading-list'
import { translatedCode } from '~/utils/search'
import { coverUrl, workSlug } from '~/utils/work'

/**
 * "Continue reading" strip of the signed-in hero: the works in progress, with a +1 that counts a
 * chapter (or a volume for a work followed by volumes); finishing the work asks for confirmation.
 */
const props = defineProps<{ entries: ListedEntry[] }>()
// Cards side by side between 768 and 1023 px (see the style).
const TABLET_COLUMNS = 2
const { t, te } = useI18n()
const localePath = useLocalePath()
const headingId = `${useId()}-heading`

const { items, errorKey, readingPrompt, addOneToProgress } = useContinueReading(() => props.entries)

/** Localised address of the work page. */
const workPath = (item: ListedEntry) =>
  localePath(`/work/${workSlug(item.work.id, item.work.title)}`)

/** "Format · Chapter 3/12" line under the title. */
function progressLine(item: ListedEntry): string {
  const unit = incrementUnit(item.entry)
  const format = translatedCode(t, te, 'genre', item.work.formats[0] ?? '')
  const progress = t(
    unit === 'chapters' ? 'home.continueReading.chapter' : 'home.continueReading.volume',
    { value: formatProgress(unitProgress(item, unit)) },
  )
  return item.work.formats.length ? `${format} · ${progress}` : progress
}

/** Accessible name of the +1 button. */
const addOneLabel = (item: ListedEntry) =>
  t(
    incrementUnit(item.entry) === 'chapters'
      ? 'home.continueReading.addChapter'
      : 'home.continueReading.addVolume',
    { title: item.work.title },
  )
</script>

<template>
  <!-- `v-show`: the strip disappears when the last work is finished, without losing the confirmation. -->
  <section
    v-show="items.length"
    class="continue-reading"
    :style="{
      '--continue-reading-count': Math.min(items.length, CONTINUE_READING_SIZE),
      '--continue-reading-count-tablet': Math.min(items.length, TABLET_COLUMNS),
    }"
    :aria-labelledby="headingId"
    data-testid="home-continue-reading"
  >
    <div class="continue-reading__header">
      <h2 :id="headingId" class="continue-reading__title">
        {{ t('home.continueReading.title') }}
      </h2>
      <NuxtLink
        :to="localePath('/list')"
        class="continue-reading__see-list link-underlined"
        data-testid="home-continue-reading-list-link"
      >
        {{ t('home.continueReading.seeList') }}
      </NuxtLink>
    </div>

    <ul class="continue-reading__list">
      <li
        v-for="item in items"
        :key="item.work.id"
        class="continue-reading__item"
        data-testid="continue-reading-work"
      >
        <NuxtLink
          :to="workPath(item)"
          class="continue-reading__cover"
          tabindex="-1"
          aria-hidden="true"
        >
          <WorkCover :url="coverUrl(item.work.coverPath)" size="sm" />
        </NuxtLink>
        <div class="continue-reading__text">
          <h3 class="continue-reading__work-title">
            <NuxtLink :to="workPath(item)" class="continue-reading__link">
              {{ item.work.title }}
            </NuxtLink>
          </h3>
          <p class="continue-reading__progress">
            <span data-testid="continue-reading-progress">{{ progressLine(item) }}</span>
            <span
              class="continue-reading__status"
              :style="{ background: `var(--status-${item.entry.status})` }"
            >
              {{ t(`readingStatus.${item.entry.status}`) }}
            </span>
          </p>
        </div>
        <UiButton
          class="continue-reading__add-one"
          :aria-label="addOneLabel(item)"
          data-testid="continue-reading-add-one"
          @click="addOneToProgress(item)"
        >
          {{ t('home.continueReading.addOne') }}
        </UiButton>
      </li>
    </ul>

    <div v-if="errorKey" class="continue-reading__error">
      <UiFormError data-testid="continue-reading-error">{{ t(errorKey) }}</UiFormError>
    </div>

    <UiConfirm
      v-model="readingPrompt.isOpen.value"
      :title="readingPrompt.title.value"
      :text="readingPrompt.text.value"
      :confirm-label="readingPrompt.confirmLabel.value"
      :cancel-label="readingPrompt.cancelLabel.value"
      :close-label="t('action.close')"
      @confirm="readingPrompt.confirm"
      @cancel="readingPrompt.decline"
    />
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Tablet: two cards side by side; from 1024 px, three. `shown`: the cards of the first row.
.continue-reading {
  --continue-reading-columns: 2;
  --continue-reading-shown: var(--continue-reading-count-tablet);

  @media (min-width: 1024px) {
    --continue-reading-columns: 3;
    --continue-reading-shown: var(--continue-reading-count);
  }
}

// From 768 px the strip never exceeds the width of its cards (12 px column gap): with
// fewer cards than columns, "See my list" stays attached to the last card.
.continue-reading__header,
.continue-reading__list,
.continue-reading__error {
  @media (min-width: 768px) {
    max-width: calc(
      (100% - (var(--continue-reading-columns) - 1) * var(--space-3)) /
        var(--continue-reading-columns) * var(--continue-reading-shown) +
        (var(--continue-reading-shown) - 1) * var(--space-3)
    );
  }
}

.continue-reading__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.continue-reading__title {
  color: var(--color-ink);
  font-size: 1.0625rem;
}

.continue-reading__see-list {
  color: var(--color-blue);
  font-size: 0.875rem;
  font-weight: 800;
}

// Cards are stacked on mobile, and up to three sit side by side on desktop.
.continue-reading__list {
  display: grid;
  gap: var(--space-3);

  @media (min-width: 768px) {
    grid-template-columns: repeat(var(--continue-reading-shown), minmax(0, 1fr));
  }
}

.continue-reading__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

.continue-reading__cover {
  flex: none;
}

.continue-reading__text {
  flex: 1;
  min-width: 0;
}

.continue-reading__work-title {
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.continue-reading__link {
  color: var(--color-blue);
  text-decoration: none;

  @include on-hover {
    text-decoration: underline;
  }
}

.continue-reading__progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 4px 0 0;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;

  // Mobile: title, then format · chapter, then the status on its own line.
  @media (max-width: 767px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.continue-reading__status {
  padding: 0 8px;
  border: var(--border);
  border-radius: var(--radius);
  color: var(--color-ink);
  font-size: 0.6875rem;
  font-weight: 800;
}

.continue-reading__add-one {
  flex: none;
  min-width: var(--touch);
  padding: 0 var(--space-2);

  // 44 px square button: strongest tilt tier. `.btn` doubles the specificity to win over
  // `UiButton`'s tier, so its pressed state must be redeclared here too.
  &.btn {
    @include tilt-on-hover(null, small);
    @include press-down;
  }
}

.continue-reading__error {
  margin-top: var(--space-2);
}
</style>
