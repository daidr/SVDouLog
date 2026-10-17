<script setup lang="ts">
import type { IPostSeriesNav } from '~~/types/feed'
import IconSeries from '~icons/mingcute/book-2-line'
import IconLeft from '~icons/mingcute/left-line'
import IconRight from '~icons/mingcute/right-line'

defineProps<{ series: IPostSeriesNav }>()

const { t } = useI18n()
</script>

<template>
  <nav class="series-nav" :aria-label="t('series.title')">
    <div class="block-title">
      <NuxtLink class="name" :to="`/blog/series/${encodeURIComponent(series.slug)}`">
        <IconSeries />
        <span>{{ series.name }}</span>
      </NuxtLink>
      <span class="position">{{ t('series.position', { index: series.index, total: series.total }) }}</span>
    </div>
    <div v-if="series.prev || series.next" class="links">
      <NuxtLink v-if="series.prev" class="link prev" :to="`/blog/${series.prev.id}`">
        <span class="label"><IconLeft />{{ t('series.prev') }}</span>
        <span class="link-title">{{ series.prev.title }}</span>
      </NuxtLink>
      <NuxtLink v-if="series.next" class="link next" :to="`/blog/${series.next.id}`">
        <span class="label">{{ t('series.next') }}<IconRight /></span>
        <span class="link-title">{{ series.next.title }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.series-nav {
  @apply rounded-xl p-4 space-y-3;
  @apply border-1 border-gray-200 dark-border-gray-700;

  .block-title {
    @apply flex items-center justify-between gap-x-3;

    .name {
      @apply font-bold text-dark/80 dark-text-light/70 flex items-center min-w-0;
      @apply transition-colors;

      svg {
        @apply mr-2 flex-shrink-0 self-center;
      }

      span {
        @apply break-words min-w-0;
      }

      &:hover {
        @apply text-primary dark-text-primary-7;
      }
    }

    .position {
      @apply flex-shrink-0 text-sm text-dark/50 dark-text-light/40;
    }
  }

  .links {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-2;
  }

  .link {
    @apply flex flex-col gap-y-1 rounded-lg px-3 py-2 min-w-0;
    @apply bg-primary-1/40 dark-bg-primary-3/20;
    @apply transition-colors;

    &:hover {
      @apply bg-primary-2/50 dark-bg-primary-4/30;
    }

    &.next {
      @apply sm:col-start-2 sm:items-end sm:text-right;
    }

    .label {
      @apply flex items-center gap-x-1 text-xs text-dark/50 dark-text-light/40;
    }

    .link-title {
      @apply text-sm font-medium text-primary dark-text-primary-7 break-words;
    }
  }
}
</style>
