<script setup lang="ts">
import type { ISeriesItem } from '~~/types/feed'
import { formatPublishedDate } from '~/utils/date'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
const headT = useHeadT()
usePageSeo({ title: () => headT('series.title') })

const { data: list } = await useFetch<ISeriesItem[]>('/api/series', { default: () => [] })

// keepalive 复用时回到离开前的位置，第一次进入回到顶部
let savedTop = 0
function container() {
  return document.querySelector('.articles-page-wrapper')
}
onBeforeRouteLeave(() => {
  savedTop = container()?.scrollTop ?? 0
})
onActivated(() => {
  requestAnimationFrame(() => {
    container()?.scrollTo({ top: savedTop, behavior: 'auto' })
  })
})
</script>

<template>
  <div class="content-wrapper">
    <div class="series-list">
      <h1 class="list-title">
        {{ t('series.title') }}
      </h1>
      <NuxtLink
        v-for="item of list" :key="item.id"
        class="series-item" :to="`/blog/series/${encodeURIComponent(item.slug)}`"
      >
        <h3 class="name">
          {{ item.name }}
        </h3>
        <div class="details">
          <span>{{ t('series.post_count', { n: item.postCount }, item.postCount) }}</span>
          <span>{{ formatPublishedDate(item.lastPublishedAt) }}</span>
        </div>
        <p v-if="item.description" class="description">
          {{ item.description }}
        </p>
      </NuxtLink>
      <p v-if="list.length === 0" class="empty">
        {{ t('series.empty') }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex flex-col items-stretch gap-y-3;

  .series-list {
    @apply w-full bg-light dark-bg-dark;
    @apply px-5 py-5 sm:(px-8 py-8);
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-4;
    view-transition-name: main-wrapper;
  }

  .list-title {
    @apply text-xl font-bold text-primary dark-text-primary-7;
  }

  .series-item {
    @apply flex flex-col rounded-2xl p-2 min-w-0;
    @apply border-gray-200/60 dark-border-gray-700/60 border-1;
    @apply dark-bg-primary-1/80;
    @apply transition-colors motion-reduce:transition-none;

    &:hover {
      @apply border-primary-2 dark-border-primary-6;
    }

    .name {
      @apply text-2xl font-bold text-primary dark-text-primary-7 break-words;
    }

    .details {
      @apply flex flex-wrap items-center gap-x-3 text-primary-4 dark-text-primary-6 text-sm;
    }

    .description {
      @apply mt-2 text-primary-4/80 dark-text-primary-5 break-words;
    }
  }

  .empty {
    @apply text-center text-primary-text py-6;
  }
}
</style>
