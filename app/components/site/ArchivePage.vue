<script setup lang="ts">
import type { IArchivePage, IFlowItem } from '~~/types/feed'

const props = defineProps<{
  /** `{ category: slug }` 或 `{ tag: name }` */
  filter: { category: string } | { tag: string }
}>()

const { t } = useI18n()

const PAGE_SIZE = 10

const { data: first, error } = await useFetch<IArchivePage>('/api/archive', { query: { ...props.filter, page: 1 } })

if (!first.value) {
  throw pageError(error.value)
}

const title = computed(() => {
  if (!first.value) return ''
  return first.value.kind === 'tag' ? `#${first.value.name}` : first.value.name
})

usePageSeo({
  title,
  description: () => first.value?.description,
})

const articles = shallowRef<IFlowItem[]>(first.value?.list ?? [])
const isEnded = ref(!first.value?.hasNext)
const isFetching = ref(false)

async function requestFetch() {
  if (isEnded.value || isFetching.value) return
  isFetching.value = true
  try {
    const page = Math.floor(articles.value.length / PAGE_SIZE) + 1
    const res = await $fetch<IArchivePage>('/api/archive', { query: { ...props.filter, page } })
    articles.value.push(...res.list)
    triggerRef(articles)
    if (!res.hasNext || res.list.length < PAGE_SIZE) isEnded.value = true
  } finally {
    isFetching.value = false
  }
}

const throttleRequestFetch = useThrottleFn(requestFetch, 100)
const loadMoreRef = ref<HTMLDivElement | null>(null)
useIntersectionObserver(loadMoreRef, ([entry]) => {
  if (entry?.isIntersecting) throttleRequestFetch()
})

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

function openArticle(post: { id: number, slug: string | null }) {
  navigateTo(postPath(post))
}
</script>

<template>
  <div v-if="first" class="content-wrapper">
    <div class="archive-header">
      <div class="meta">
        <NuxtLink to="/blog/topics" class="all-topics">
          {{ t(first.kind === 'tag' ? 'archive.tag' : 'archive.category') }}
        </NuxtLink>
        <span>{{ t('series.post_count', { n: first.total }, first.total) }}</span>
      </div>
      <h1 class="name">
        {{ title }}
      </h1>
      <p v-if="first.description" class="description">
        {{ first.description }}
      </p>
    </div>
    <div class="article-list">
      <SiteArticleItem
        v-for="article of articles" :key="article.id"
        :article="article" @click.prevent="openArticle(article)"
      />
      <p v-if="articles.length === 0" class="empty">
        {{ t('archive.empty') }}
      </p>
      <div v-if="!isEnded && isHydrated" ref="loadMoreRef" class="load-more" :class="{ disabled: isFetching }" @click="requestFetch">
        {{ isFetching ? t('global.loading') : t('global.load_more') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex flex-col items-stretch gap-y-3;

  .archive-header {
    @apply w-full bg-light dark-bg-dark px-5 md:px-8 py-5 md:py-6;
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-2;
    view-transition-name: main-announcement;

    .meta {
      @apply flex items-center gap-x-3 text-sm text-primary-4 dark-text-primary-6;

      .all-topics {
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

  .empty {
    @apply text-center text-primary-text py-6;
  }

  .load-more {
    @apply w-full text-center text-base text-primary dark-text-primary-9;
    @apply cursor-pointer bg-primary-1/70 dark-bg-primary-5/50;
    @apply py-2 transition-colors rounded-xl;

    &:hover {
      @apply bg-primary-2/50 dark-bg-primary-5/80;
    }

    &.disabled {
      @apply pointer-events-none;
    }
  }
}
</style>
