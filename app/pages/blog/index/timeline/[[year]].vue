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
  month: 'numeric',
  day: 'numeric',
})

function localDate(iso: string) {
  const parts = LOCAL_DATE.formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { month: get('month'), day: get('day') }
}

const monthNameFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' }))
const weekdayFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: SITE_TIME_ZONE }))

const monthCounts = computed(() => new Map(yearSummary?.months.map(m => [m.month, m.count])))

/** 一月到十二月各发了几篇，柱高按当年最多的那个月归一 */
const monthBars = computed(() => {
  const max = Math.max(1, ...monthCounts.value.values())
  return Array.from({ length: 12 }, (_, i) => {
    const count = monthCounts.value.get(i + 1) ?? 0
    return { month: i + 1, count, ratio: count / max }
  })
})

const groups = computed(() => {
  const result: { month: number, name: string, count: number, posts: (ITimelinePost & { day: string, weekday: string })[] }[] = []
  for (const post of posts.value) {
    const { month, day } = localDate(post.publishedAt)
    let group = result.at(-1)
    if (!group || group.month !== month) {
      group = {
        month,
        name: monthNameFormatter.value.format(Date.UTC(2000, month - 1, 1)),
        count: monthCounts.value.get(month) ?? 0,
        posts: [],
      }
      result.push(group)
    }
    group.posts.push({ ...post, day: String(day).padStart(2, '0'), weekday: weekdayFormatter.value.format(new Date(post.publishedAt)) })
  }
  return result
})

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function container() {
  return document.querySelector('.articles-page-wrapper')
}

/** 跳到某个月；文章多、那个月还没加载到时先往下加载 */
async function jumpToMonth(month: number) {
  const id = `month-${month}`
  while (!document.getElementById(id) && !isEnded.value) {
    await requestFetch()
    await nextTick()
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// keepalive 复用时回到离开前的位置，第一次进入回到顶部
let savedTop = 0
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
      <div class="hero">
        <div class="hero-text">
          <h1 class="label">
            {{ t('timeline.title') }}
          </h1>
          <div v-if="year !== null" class="year">
            {{ year }}
          </div>
          <div v-if="yearSummary" class="year-count">
            {{ t('series.post_count', { n: yearSummary.count }, yearSummary.count) }}
          </div>
        </div>
        <div v-if="yearSummary" class="month-bars">
          <button
            v-for="bar of monthBars" :key="bar.month" type="button"
            class="bar" :class="{ empty: !bar.count }" :disabled="!bar.count"
            :title="bar.count ? `${pad(bar.month)} · ${bar.count}` : undefined"
            :aria-label="bar.count ? `${pad(bar.month)} · ${bar.count}` : undefined"
            @click="jumpToMonth(bar.month)"
          >
            <span class="fill-track">
              <span class="fill" :style="{ height: `${Math.max(bar.ratio * 100, bar.count ? 12 : 0)}%` }" />
            </span>
            <span class="num">{{ bar.month }}</span>
          </button>
        </div>
      </div>
      <nav v-if="summary!.years.length > 1" class="years">
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
      <section v-for="group of groups" :id="`month-${group.month}`" :key="group.month" class="month">
        <header class="month-head">
          <span class="month-num">{{ pad(group.month) }}</span>
          <span class="month-meta">
            <span class="month-name">{{ group.name }}</span>
            <span class="month-count">{{ t('series.post_count', { n: group.count }, group.count) }}</span>
          </span>
        </header>
        <ol class="post-list">
          <li v-for="post of group.posts" :key="post.id" class="post-row">
            <NuxtLink class="post-link" :to="postPath(post)">
              <time class="date" :datetime="post.publishedAt">
                <span class="day">{{ post.day }}</span>
                <span class="weekday">{{ post.weekday }}</span>
              </time>
              <span class="post-title">
                {{ post.title }}
                <IconLock v-if="post.passwordProtected" class="lock" :aria-label="t('global.password_protected')" />
              </span>
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
}

.timeline-header {
  @apply relative w-full bg-light dark-bg-dark px-5 md:px-8 pt-5 md:pt-7 pb-5 md:pb-6;
  @apply sm:rounded-8;
  @apply sm:shadow-2xl general-shadow;
  @apply flex flex-col gap-y-5;
  view-transition-name: main-announcement;

  .hero {
    @apply flex flex-col md:flex-row md:items-end md:justify-between gap-5;
  }

  .label {
    @apply text-sm font-bold tracking-widest text-primary-4 dark-text-primary-6;
  }

  .year {
    font-family: BEYNO-online, sans-serif;
    @apply text-6xl md:text-7xl leading-none mt-2 text-primary dark-text-primary-7;
  }

  .year-count {
    @apply mt-2 text-primary-4 dark-text-primary-6;
  }

  .month-bars {
    @apply grid grid-cols-12 items-end gap-1 sm:gap-1.5 w-full md:w-auto md:min-w-72 lg:min-w-96;

    .bar {
      @apply flex flex-col items-center gap-y-1 cursor-pointer p-0 m-0 border-0 bg-transparent;

      &.empty {
        @apply cursor-default;
      }

      .fill-track {
        @apply relative w-full h-16 md:h-20 rounded-md bg-primary-1/50 dark-bg-primary-2/40 overflow-hidden;
      }

      .fill {
        @apply absolute bottom-0 left-0 right-0 rounded-md bg-primary/70 dark-bg-primary-6/80;
        @apply transition-colors motion-reduce:transition-none;
      }

      &:not(.empty):hover .fill {
        @apply bg-primary dark-bg-primary-7;
      }

      .num {
        @apply text-xs text-primary-4 dark-text-primary-6 tabular-nums;
      }

      &.empty .num {
        @apply opacity-50;
      }
    }
  }

  .years {
    @apply flex flex-wrap gap-2 pt-4 border-t-1 border-gray-200/60 dark-border-gray-700/60;

    .year-link {
      @apply flex items-center gap-x-2 rounded-xl px-3 py-1;
      @apply text-primary-text font-semibold tabular-nums;
      @apply transition-colors motion-reduce:transition-none;

      .count {
        @apply text-sm font-normal text-primary-4 dark-text-primary-6;
      }

      &:hover {
        @apply bg-primary-1/70 dark-bg-primary-5/50 text-primary dark-text-primary-8;
      }

      &.active {
        @apply bg-primary text-light dark-bg-primary-6 dark-text-dark pointer-events-none;

        .count {
          @apply text-light/80 dark-text-dark/70;
        }
      }
    }
  }
}

.timeline-body {
  @apply w-full bg-light dark-bg-dark;
  @apply px-5 py-6 sm:(px-8 py-8);
  @apply sm:rounded-8;
  @apply sm:shadow-2xl general-shadow;
  @apply flex flex-col gap-y-8;
  view-transition-name: main-wrapper;
}

.month {
  @apply grid grid-cols-1 md:grid-cols-[9rem_1fr] gap-x-6 gap-y-3;
  scroll-margin-top: 1rem;

  .month-head {
    @apply flex md:flex-col items-baseline md:items-start gap-x-3 md:sticky md:top-4 self-start;
  }

  .month-num {
    font-family: BEYNO-online, sans-serif;
    @apply text-4xl md:text-5xl leading-none text-primary-2 dark-text-primary-4;
  }

  .month-meta {
    @apply flex md:flex-col items-baseline md:items-start gap-x-2 md:mt-2;
  }

  .month-name {
    @apply text-lg font-bold text-primary dark-text-primary-7;
  }

  .month-count {
    @apply text-sm text-primary-4 dark-text-primary-6;
  }
}

.post-list {
  @apply relative flex flex-col gap-y-1 self-start;

  // 时间轴：竖线穿过每篇前面的圆点
  &::before {
    content: '';
    @apply absolute top-2 bottom-2 left-[1.625rem] w-2px rounded-full bg-primary-1 dark-bg-primary-3;
  }
}

.post-row {
  @apply relative;

  .post-link {
    @apply relative flex items-center gap-x-4 rounded-2xl pl-1 pr-3 py-2;
    @apply border-1 border-transparent;
    transition:
      border 0.5s linear,
      background-position-x 0.5s ease-out;
    @apply motion-reduce:transition-none;

    background-image: linear-gradient(
      90deg,
      rgba(var(--color-primary-1), 0.4) 0%,
      rgba(var(--color-primary-1), 0.4) 45%,
      transparent 60%,
      transparent 100%
    );
    background-size: 300% 100%;
    background-position-x: 100%;
    background-repeat: no-repeat;

    .dark & {
      background-image: linear-gradient(
        90deg,
        rgba(var(--color-primary-3), 0.5) 0%,
        rgba(var(--color-primary-3), 0.5) 45%,
        transparent 60%,
        transparent 100%
      );
    }

    &:hover {
      @apply border-primary-2 dark-border-primary-6;
      background-position-x: 0%;

      .date {
        @apply bg-primary text-light dark-bg-primary-6 dark-text-dark border-transparent;

        .day {
          @apply text-light dark-text-dark;
        }

        .weekday {
          @apply text-light/80 dark-text-dark/70;
        }
      }
    }
  }

  .date {
    @apply relative z-1 flex-shrink-0 w-11 h-11 rounded-full;
    @apply flex flex-col items-center justify-center leading-none;
    @apply bg-light dark-bg-dark border-2 border-primary-1 dark-border-primary-3;
    @apply transition-colors motion-reduce:transition-none;

    .day {
      @apply text-sm font-bold text-primary dark-text-primary-7 tabular-nums;
    }

    .weekday {
      @apply mt-0.5 text-[0.6rem] text-primary-4 dark-text-primary-6;
    }
  }

  .post-title {
    @apply min-w-0 break-words font-semibold text-primary-text;

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
</style>
