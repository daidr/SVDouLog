<script setup lang="ts">
import type { ITaxonomy } from '~~/types/feed'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('archive.topics')) })

const { data } = await useFetch<ITaxonomy>('/api/taxonomy', { default: () => ({ categories: [], tags: [] }) })

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
    <section v-if="data.categories.length" class="topic-block categories">
      <h1 class="block-title">
        {{ t('archive.categories') }}
      </h1>
      <NuxtLink
        v-for="item of data.categories" :key="item.id"
        class="category-item" :to="`/blog/category/${encodeURIComponent(item.slug)}`"
      >
        <h3 class="name">
          {{ item.name }}
        </h3>
        <div class="details">
          {{ t('series.post_count', { n: item.postCount }, item.postCount) }}
        </div>
        <p v-if="item.description" class="description">
          {{ item.description }}
        </p>
      </NuxtLink>
    </section>
    <section v-if="data.tags.length" class="topic-block tags">
      <h2 class="block-title">
        {{ t('archive.tags') }}
      </h2>
      <div class="tag-cloud">
        <NuxtLink
          v-for="tag of data.tags" :key="tag.name"
          class="tag-item" :to="`/blog/tag/${encodeURIComponent(tag.name)}`"
        >
          <span class="tag-name">#{{ tag.name }}</span>
          <span class="count">{{ tag.count }}</span>
        </NuxtLink>
      </div>
    </section>
    <section v-if="!data.categories.length && !data.tags.length" class="topic-block">
      <p class="empty">
        {{ t('archive.empty') }}
      </p>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex flex-col items-stretch gap-y-3;

  .topic-block {
    @apply w-full bg-light dark-bg-dark;
    @apply px-5 py-5 sm:(px-8 py-8);
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-4;

    &:first-child {
      view-transition-name: main-wrapper;
    }
  }

  .block-title {
    @apply text-xl font-bold text-primary dark-text-primary-7;
  }

  .category-item {
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
      @apply text-primary-4 dark-text-primary-6 text-sm;
    }

    .description {
      @apply mt-2 text-primary-4/80 dark-text-primary-5 break-words;
    }
  }

  .tag-cloud {
    @apply flex flex-wrap gap-2;

    .tag-item {
      @apply flex items-center gap-x-2 min-w-0 max-w-full rounded-xl px-3 py-1;
      @apply border-gray-200/60 dark-border-gray-700/60 border-1;
      @apply dark-bg-primary-1/80;
      @apply transition-colors motion-reduce:transition-none;

      &:hover {
        @apply border-primary-2 dark-border-primary-6;
      }

      .tag-name {
        @apply text-primary dark-text-primary-7 font-semibold truncate;
      }

      .count {
        @apply text-sm text-primary-4 dark-text-primary-6 flex-shrink-0;
      }
    }
  }

  .empty {
    @apply text-center text-primary-text py-6;
  }
}
</style>
