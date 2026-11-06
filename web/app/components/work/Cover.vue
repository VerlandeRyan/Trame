<script setup lang="ts">
// Avec image : liseré blanc et filet d'encre. Sans image : trame rose sur bleu pâle, jamais sur une image.
// Largeurs normalisées (voir COVER_SIZES) ; sans `size`, la couverture remplit son parent.
// `wideSize` remplace `size` à partir de 768 px.
import type { CoverSize } from '~/utils/cover'

const props = withDefaults(
  defineProps<{ url?: string; size?: CoverSize; wideSize?: CoverSize }>(),
  {
    url: undefined,
    size: undefined,
    wideSize: undefined,
  },
)

// Les petites couvertures ont un liseré et une trame plus fins.
const isCompact = computed(() => props.size === 'sm' || props.size === 'md')
</script>

<template>
  <div
    class="cover"
    :class="[
      size && `cover--${size}`,
      wideSize && `cover--wide-${wideSize}`,
      isCompact && 'cover--compact',
      url ? 'cover--image' : 'cover--empty',
    ]"
  >
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <span v-else class="cover__pad"><Icon name="tabler:photo" aria-hidden="true" /></span>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// Garder ces largeurs identiques à COVER_SIZES (utils/cover.ts) : un test les compare.
$sizes: (
  'sm': 64px,
  'md': 72px,
  'lg': 96px,
  'xl': 112px,
  'hero': 210px,
);

.cover {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--cover-width, auto);
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--color-surface);
}

@each $name, $width in $sizes {
  .cover--#{$name} {
    --cover-width: #{$width};
    flex: none;
  }

  .cover--wide-#{$name} {
    @media (min-width: 768px) {
      --cover-width: #{$width};
      flex: none;
    }
  }
}

.cover--image {
  padding: 3px;

  img {
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-ink);
    object-fit: cover;
    object-position: top center;
  }

  &.cover--compact {
    padding: 2px;
  }
}

.cover--empty {
  background-color: var(--color-cover-blank);

  &::before {
    @include screentone(var(--color-rose-vivid), 9px, 150deg);
  }

  &.cover--compact::before {
    background-size: 7px 7px;
  }
}

.cover__pad {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: var(--border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: 22px;
}

.cover--compact .cover__pad {
  width: 26px;
  height: 26px;
  border-radius: var(--radius);
  font-size: 15px;
}
</style>
