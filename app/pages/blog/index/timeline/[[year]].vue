<script setup lang="ts">
import type { ITimelinePage, ITimelinePost, ITimelineSummary } from '~~/types/feed'
import IconLock from '~icons/mingcute/lock-line'

definePageMeta({
  isInArticlePage: false,
})

const { t, locale } = useI18n()
const headT = useHeadT()

// 这一页在 keepalive 里，参数在创建时取定，离开后 route 已经是别的页面
const yearParam = useRoute().params.year
const requestedYear = yearParam ? Number(yearParam) : null

const { data: summary, error: summaryError } = await useFetch<ITimelineSummary>('/api/timeline')
if (!summary.value) {
  throw pageError(summaryError.value)
}

const latestYear = summary.value.years[0]?.year ?? null
// 最新的一年就是 /blog/timeline 本身，不留两个地址
if (requestedYear !== null && requestedYear === latestYear) {
  await navigateTo('/blog/timeline', { redirectCode: 302, replace: true })
}
const year = requestedYear ?? latestYear
const yearSummary = summary.value.years.find(y => y.year === year)
if (requestedYear !== null && !yearSummary) {
  throw pageError()
}

const { data: first, error } = year === null
  ? { data: ref<ITimelinePage | null>({ list: [], total: 0, hasNext: false }), error: ref(null) }
  : await useFetch<ITimelinePage>(`/api/timeline/${year}`, { query: { page: 1 } })
if (!first.value) {
  throw pageError(error.value)
}

usePageSeo({
  title: () => requestedYear === null ? headT('timeline.title') : `${headT('timeline.title')} · ${requestedYear}`,
})

function yearPath(y: number) {
  return y === latestYear ? '/blog/timeline' : `/blog/timeline/${y}`
}

const PAGE_SIZE = 100
const posts = shallowRef<ITimelinePost[]>(first.value?.list ?? [])
const isEnded = ref(!first.value?.hasNext)
const isFetching = ref(false)

async function requestFetch() {
  if (year === null || isEnded.value || isFetching.value) return
  isFetching.value = true
  try {
    const page = Math.floor(posts.value.length / PAGE_SIZE) + 1
    const res = await $fetch<ITimelinePage>(`/api/timeline/${year}`, { query: { page } })
    posts.value = [...posts.value, ...res.list]
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

// 年月日按站点时区取，与服务端切月的口径一致
const LOCAL_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function localDate(iso: string) {
  const parts = LOCAL_DATE.formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { month: get('month'), day: get('day') }
}

const monthFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', timeZone: 'UTC' }))

const groups = computed(() => {
  const counts = new Map(yearSummary?.months.map(m => [m.month, m.count]))
  const result: { month: number, label: string, count: number, posts: (ITimelinePost & { date: string })[] }[] = []
  for (const post of posts.value) {
    const { month, day } = localDate(post.publishedAt)
    let group = result.at(-1)
    if (!group || group.month !== month) {
      group = {
        month,
        label: monthFormatter.value.format(Date.UTC(year!, month - 1, 1)),
        count: counts.get(month) ?? 0,
        posts: [],
      }
      result.push(group)
    }
    group.posts.push({ ...post, date: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` })
  }
  return result
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
</script>

<template>
  <div class="content-wrapper">
    <div class="timeline-header">
      <div class="heading">
        <h1 class="title">
          {{ t('timeline.title') }}
        </h1>
        <span class="total">{{ t('series.post_count', { n: summary!.total }, summary!.total) }}</span>
      </div>
      <nav v-if="summary!.years.length" class="years">
        <NuxtLink
          v-for="item of summary!.years" :key="item.year"
          class="year-link" :class="{ active: item.year === year }"
          :to="yearPath(item.year)" :aria-current="item.year === year ? 'page' : undefined"
        >
          <span>{{ item.year }}</span>
          <span class="count">{{ item.count }}</span>
        </NuxtLink>
      </nav>
    </div>
    <div class="timeline-body">
      <section v-for="group of groups" :key="group.month" class="month">
        <h2 class="month-title">
          <span>{{ group.label }}</span>
          <span class="count">{{ group.count }}</span>
        </h2>
        <ol class="post-list">
          <li v-for="post of group.posts" :key="post.id" class="post-row">
            <time class="day" :datetime="post.publishedAt">{{ post.date }}</time>
            <NuxtLink class="post-title" :to="postPath(post)">
              {{ post.title }}
              <IconLock v-if="post.passwordProtected" class="lock" :aria-label="t('global.password_protected')" />
            </NuxtLink>
          </li>
        </ol>
      </section>
      <p v-if="groups.length === 0" class="empty">
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

  .timeline-header {
    @apply w-full bg-light dark-bg-dark px-5 md:px-8 py-5 md:py-6;
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-4;
    view-transition-name: main-announcement;

    .heading {
      @apply flex items-baseline gap-x-3;
    }

    .title {
      @apply text-2xl md:text-3xl font-extrabold text-primary dark-text-primary-7;
    }

    .total {
      @apply text-sm text-primary-4 dark-text-primary-6;
    }
  }

  .years {
    @apply flex flex-wrap gap-2;

    .year-link {
      @apply flex items-center gap-x-2 rounded-xl px-3 py-1;
      @apply border-gray-200/60 dark-border-gray-700/60 border-1;
      @apply dark-bg-primary-1/80;
      @apply text-primary dark-text-primary-7 font-semibold tabular-nums;
      @apply transition-colors motion-reduce:transition-none;

      .count {
        @apply text-sm font-normal text-primary-4 dark-text-primary-6;
      }

      &:hover {
        @apply border-primary-2 dark-border-primary-6;
      }

      &.active {
        @apply border-primary-3 dark-border-primary-6 bg-primary-1/70 dark-bg-primary-3;
      }
    }
  }

  .timeline-body {
    @apply w-full bg-light dark-bg-dark;
    @apply px-5 py-5 sm:(px-8 py-8);
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex flex-col gap-y-6;
    view-transition-name: main-wrapper;
  }

  .month-title {
    @apply flex items-baseline gap-x-2 mb-2;
    @apply text-xl font-bold text-primary dark-text-primary-7;

    .count {
      @apply text-sm font-normal text-primary-4 dark-text-primary-6;
    }
  }

  .post-list {
    @apply flex flex-col border-l-2 border-primary-1 dark-border-primary-3 ml-1;
  }

  .post-row {
    @apply flex items-baseline gap-x-3 min-w-0 pl-4 py-1.5;

    .day {
      @apply flex-shrink-0 text-sm text-primary-4 dark-text-primary-6 tabular-nums;
    }

    .post-title {
      @apply min-w-0 break-words text-primary-text font-semibold transition-colors;

      &:hover {
        @apply text-primary dark-text-primary-8;
      }

      .lock {
        @apply inline-block ml-1 align-[-0.1em] text-sm text-primary-4 dark-text-primary-6;
      }
    }
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
