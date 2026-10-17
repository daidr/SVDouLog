<script setup lang="ts">
import type { ISearchItem } from '~~/types/feed'
import IconSearch from '~icons/mingcute/search-line'

definePageMeta({
  isInArticlePage: false,
})

interface SearchResponse {
  list: ISearchItem[]
  total: number
  hasNext: boolean
}

const { t } = useI18n()
useHead({ title: computed(() => t('search.open')) })

const route = useRoute()
const router = useRouter()
// 这一页在 keepalive 里：离开后 route 已经是别的页面，不能把它的 query 当搜索词
const PAGE_NAME = route.name

function routeQuery() {
  return String(route.query.q ?? '').trim()
}

const input = ref(routeQuery())
const results = shallowRef<ISearchItem[]>([])
const committed = ref('')
const page = ref(0)
const hasNext = ref(false)
const isFetching = ref(false)
let requestId = 0

async function load(q: string, nextPage: number) {
  const id = ++requestId
  isFetching.value = true
  try {
    const res = await $fetch<SearchResponse>('/api/search', { query: { q, page: nextPage } })
    // 输入更快时丢掉过期的响应
    if (id !== requestId) return
    results.value = nextPage === 1 ? res.list : [...results.value, ...res.list]
    committed.value = q
    page.value = nextPage
    hasNext.value = res.hasNext
  } finally {
    if (id === requestId) isFetching.value = false
  }
}

async function search(q: string) {
  if (!q) {
    requestId++
    results.value = []
    committed.value = ''
    hasNext.value = false
    isFetching.value = false
    return
  }
  await load(q, 1)
}

await search(routeQuery())

watch(() => (route.name === PAGE_NAME ? routeQuery() : null), (q) => {
  if (q === null || q === committed.value) return
  input.value = q
  search(q)
})

function commit() {
  const q = input.value.trim()
  if (q === routeQuery()) return
  router.replace({ query: q ? { q } : {} })
}

const debouncedCommit = useDebounceFn(commit, 300)

function loadMore() {
  if (!hasNext.value || isFetching.value || !committed.value) return
  load(committed.value, page.value + 1)
}

const loadMoreRef = ref<HTMLDivElement | null>(null)
useIntersectionObserver(loadMoreRef, ([entry]) => {
  if (entry?.isIntersecting) loadMore()
})

const inputRef = ref<HTMLInputElement | null>(null)
onMounted(() => {
  if (!input.value) inputRef.value?.focus()
})
</script>

<template>
  <div class="content-wrapper">
    <form class="search-bar" role="search" @submit.prevent="commit">
      <IconSearch class="icon" />
      <input
        ref="inputRef"
        v-model="input"
        type="search"
        name="q"
        enterkeyhint="search"
        autocomplete="off"
        maxlength="100"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.open')"
        @input="debouncedCommit"
      >
    </form>
    <div v-if="committed" class="result-list">
      <SiteSearchResultItem v-for="item of results" :key="item.id" :item="item" />
      <p v-if="results.length === 0" class="empty">
        {{ t('search.empty') }}
      </p>
      <div v-if="hasNext" ref="loadMoreRef" class="load-more" :class="{ disabled: isFetching }" @click="loadMore">
        {{ isFetching ? t('global.loading') : t('global.load_more') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex flex-col items-stretch gap-y-3;

  .search-bar {
    @apply w-full bg-light dark-bg-dark px-5 md:px-8 py-4;
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
    @apply flex items-center gap-x-4;
    @apply text-lg text-primary-text;
    view-transition-name: main-announcement;

    .icon {
      @apply flex-shrink-0;
    }

    input {
      @apply flex-1 min-w-0 bg-transparent outline-none border-none p-0;
      @apply text-lg text-primary dark-text-primary-8;
      @apply placeholder:text-primary-text/60;

      &::-webkit-search-cancel-button {
        @apply cursor-pointer;
      }
    }
  }

  .result-list {
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
