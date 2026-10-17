<script setup lang="ts">
import type { ISeriesDetail } from '~~/types/feed'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()

// 这一页在 keepalive 里，slug 在创建时取定，离开后 route 已经是别的页面
const slug = String(useRoute().params.slug ?? '')

const { data: series } = await useFetch<ISeriesDetail>(`/api/series/${encodeURIComponent(slug)}`)

if (!series.value) {
  navigateTo('/404', { replace: true })
}

useHead({
  title: computed(() => series.value?.name ?? ''),
  meta: computed(() => series.value?.description
    ? [{ name: 'description', content: series.value.description }]
    : []),
})

/**
 * 页面被 keepalive 复用：离开时记下滚动位置，回来时恢复；第一次进入回到顶部
 * （从文章页跳过来时外层滚动容器还停在文章里）。
 */
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

function openArticle(id: number) {
  navigateTo(`/blog/${id}`)
}
</script>

<template>
  <div v-if="series" class="content-wrapper">
    <div class="series-header">
      <div class="meta">
        <NuxtLink to="/blog/series" class="all-series">
          {{ t('series.title') }}
        </NuxtLink>
        <span>{{ t('series.post_count', { n: series.posts.length }, series.posts.length) }}</span>
      </div>
      <h1 class="name">
        {{ series.name }}
      </h1>
      <p v-if="series.description" class="description">
        {{ series.description }}
      </p>
    </div>
    <div class="article-list">
      <SiteArticleItem
        v-for="(post, i) of series.posts" :key="post.id"
        :article="post" :index="i + 1" @click.prevent="openArticle(post.id)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex flex-col items-stretch gap-y-3;

  .series-header {
    @apply w-full bg-light dark-bg-dark px-5 md:px-8 py-5 md:py-6;
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-2;
    view-transition-name: main-announcement;

    .meta {
      @apply flex items-center gap-x-3 text-sm text-primary-4 dark-text-primary-6;

      .all-series {
        @apply font-bold text-primary-text transition-colors;

        &:hover {
          @apply text-primary dark-text-primary-8;
        }
      }
    }

    .name {
      @apply text-2xl md:text-3xl font-extrabold text-primary dark-text-primary-7 break-words;
    }

    .description {
      @apply text-primary-4 dark-text-primary-5 break-words;
    }
  }

  .article-list {
    @apply w-full bg-light dark-bg-dark;
    @apply px-5 py-5 sm:(px-8 py-8);
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-4;
    view-transition-name: main-wrapper;
  }
}
</style>
