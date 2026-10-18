<script setup lang="ts">
import type { IRelatedItem } from '~~/types/feed'
import { formatPublishedDate } from '~/utils/date'

const props = defineProps<{ postId: number }>()

const { t } = useI18n()

const { data } = await useFetch<IRelatedItem[]>(() => `/api/posts/${props.postId}/related`, {
  key: `related-${props.postId}`,
  default: () => [],
})
</script>

<template>
  <section v-if="data?.length" class="related-posts">
    <h3 class="related-posts__title">
      {{ t('related.title') }}
    </h3>
    <ul class="related-posts__list">
      <li v-for="item of data" :key="item.id">
        <NuxtLink class="related-item" :to="postPath(item)">
          <span class="related-item__title">{{ item.title }}</span>
          <span class="related-item__details">
            <span>{{ formatPublishedDate(item.publishedAt) }}</span>
            <span v-if="item.categoryName">{{ item.categoryName }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.related-posts {
  @apply flex flex-col gap-4;
}

.related-posts__title {
  @apply text-xl font-bold text-primary dark-text-primary-7;
}

.related-posts__list {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-3;
}

.related-item {
  @apply h-full flex flex-col justify-between gap-2 rounded-2xl px-4 py-3 min-w-0;
  @apply border-gray-200/60 dark-border-gray-700/60 border-1;
  @apply dark-bg-primary-1/80;
  @apply transition-colors motion-reduce:transition-none;

  &:hover {
    @apply border-primary-2 dark-border-primary-6;
  }
}

.related-item__title {
  @apply text-base md:text-lg font-bold text-primary dark-text-primary-7 break-words;
  @apply overflow-hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.related-item__details {
  @apply flex flex-wrap items-center gap-x-3 text-sm text-primary-4 dark-text-primary-6;
}
</style>
