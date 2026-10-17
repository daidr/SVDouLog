<script setup lang="ts">
import type { ISearchItem } from '~~/types/feed'
import { formatPublishedDate } from '~/utils/date'

const props = defineProps<{ item: ISearchItem }>()

const formattedDate = computed(() => formatPublishedDate(props.item.publishedAt))
</script>

<template>
  <NuxtLink class="search-item" :to="`/blog/${item.id}`">
    <h3 class="title">
      <SiteHighlightText :text="item.title" :ranges="item.titleHighlights" />
    </h3>
    <div class="details">
      <span>{{ formattedDate }}</span>
      <span v-if="item.categoryName">{{ item.categoryName }}</span>
      <span v-if="item.tags.length" class="tag">#{{ item.tags[0] }}</span>
    </div>
    <p v-if="item.snippet.text" class="snippet">
      <SiteHighlightText :text="item.snippet.text" :ranges="item.snippet.highlights" />
    </p>
  </NuxtLink>
</template>

<style lang="scss" scoped>
.search-item {
  @apply flex flex-col rounded-2xl p-2 min-w-0;
  @apply border-gray-200/60 dark-border-gray-700/60 border-1;
  @apply dark-bg-primary-1/80;
  @apply transition-colors motion-reduce:transition-none;

  &:hover {
    @apply border-primary-2 dark-border-primary-6;
  }

  .title {
    @apply text-xl md:text-2xl font-bold text-primary dark-text-primary-7 break-words;
  }

  .details {
    @apply flex flex-wrap items-center gap-x-3 text-primary-4 dark-text-primary-6 text-sm;
  }

  .snippet {
    @apply mt-2 overflow-hidden text-primary-4/80 dark-text-primary-5 break-words;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
}
</style>
