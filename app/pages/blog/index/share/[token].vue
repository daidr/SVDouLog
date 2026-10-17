<script setup lang="ts">
import type { ISharedPost } from '~~/types/feed'
import IconTime from '~icons/mingcute/calendar-2-line'
import IconUnlink from '~icons/mingcute/unlink-line'
import { formatPublishedDate } from '~/utils/date'

definePageMeta({
  isInArticlePage: true,
})

const { t } = useI18n()
const token = useRoute().params.token as string

// 页面 HTML 里就是草稿正文：CDN / 平台缓存都不能存
if (import.meta.server) {
  useResponseHeader('cache-control').value = 'private, no-store'
  useResponseHeader('x-robots-tag').value = 'noindex, nofollow'
}

const { data } = await useFetch<ISharedPost>(`/api/share/${encodeURIComponent(token)}`)

// 分享期间已经公开了：去正式页面
if (data.value?.published) {
  await navigateTo(data.value.path, { replace: true, redirectCode: 302 })
}

// 草稿只凭链接可见：不进索引；页面里的外链也不带上这条地址（Referer 里会有 token）
useHead({
  title: computed(() => data.value && !data.value.published ? data.value.post.title || t('share.untitled') : t('share.invalid')),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

const article = computed(() => data.value && !data.value.published ? data.value.post : null)

const EXPIRES_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Shanghai',
})
const expiresLabel = computed(() => data.value && !data.value.published
  ? t('share.expires', { time: EXPIRES_FORMATTER.format(new Date(data.value.expiresAt)) })
  : '')

const formattedDate = computed(() => formatPublishedDate(article.value?.publishedAt))

const catalogList = computed(() => article.value?.titleList || [])
const showSidebar = computed(() => catalogList.value.length > 0)

const activeTitleId = ref('')
function setActiveTitle(title: string | null) {
  activeTitleId.value = title || ''
}

/**
 * 统计里不能出现带 token 的地址：nuxt-umami 每次换页都按当前 URL 上报，且没有按路由排除的配置，
 * 只认 localStorage 的 `umami.disabled`。在本页期间临时置上，离开时还原（读者自己关掉的保持不动）。
 */
const UMAMI_DISABLED = 'umami.disabled'
let disabledByUs = false
function pauseUmami() {
  try {
    if (localStorage.getItem(UMAMI_DISABLED) !== '1') {
      localStorage.setItem(UMAMI_DISABLED, '1')
      disabledByUs = true
    }
  } catch {}
}
function resumeUmami() {
  if (!disabledByUs) return
  disabledByUs = false
  try {
    localStorage.removeItem(UMAMI_DISABLED)
  } catch {}
}
onBeforeMount(pauseUmami)
onBeforeUnmount(resumeUmami)
// 直接关掉标签页不会卸载组件；从往返缓存回来时再暂停一次
useEventListener('pagehide', resumeUmami)
useEventListener('pageshow', (e: PageTransitionEvent) => {
  if (e.persisted) pauseUmami()
})

const toTop = inject('toTop') as () => void
onMounted(() => toTop())
</script>

<script lang="ts">
export default {
  name: 'SharedDraftPage',
}
</script>

<template>
  <div v-if="article" class="content-wrapper">
    <main :class="{ 'sidebar-limit': showSidebar }">
      <div class="article-wrapper" :class="{ 'sidebar-limit': showSidebar }">
        <div class="header">
          <div class="draft-badge">
            <span>{{ t('share.badge') }}</span>
            <span class="draft-expires">{{ expiresLabel }}</span>
          </div>
          <div class="title">
            {{ article.title || t('share.untitled') }}
          </div>
          <div class="details">
            <div class="time">
              <IconTime />
              {{ formattedDate }}
            </div>
            <span v-if="article.categoryName">{{ article.categoryName }}</span>
            <span v-for="tag of article.tags" :key="tag">#{{ tag }}</span>
          </div>
        </div>
        <div v-if="article.heroUrl" class="article-image">
          <img :src="article.heroUrl" :srcset="article.heroSrcset ?? undefined" sizes="(max-width: 1200px) 100vw, 856px">
        </div>
        <CommonArticleRender :article="article.content" @active-title="setActiveTitle" />
        <SiteSeriesNav v-if="article.series" :series="article.series" />
      </div>
    </main>

    <div v-if="showSidebar" class="sidebar">
      <CommonArticleCatalog
        :catalog="catalogList"
        :active-title="activeTitleId"
      />
    </div>

    <ClientOnly>
      <Teleport to="body">
        <SiteToTopButton :show-process="true" scroll-el=".articles-page-wrapper" bounding-el=".blog-article-wrapper" />
      </Teleport>
    </ClientOnly>
  </div>
  <div v-else class="content-wrapper">
    <main>
      <div class="article-wrapper invalid">
        <IconUnlink class="invalid-icon" />
        <span>{{ t('share.invalid') }}</span>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// 版式与正式文章页（blog/index/[slug].vue）一致，读者看到的就是发布后的样子
.content-wrapper {
  @apply w-full flex;
  @apply text-dark dark-text-light;

  main {
    @apply w-full flex flex-col sm:gap-y-5 <sm:mb-8;

    .sidebar-limit {
      @apply max-w-856px;
    }
  }

  .article-wrapper {
    @apply bg-light dark-bg-dark px-5 py-5 md:px-8 md:py-8 w-full;
    @apply sm:rounded-8 gap-y-5 flex flex-col;
    @apply sm:shadow-2xl general-shadow;
    view-transition-name: main-wrapper;

    word-wrap: break-word;

    &.invalid {
      @apply items-center justify-center gap-y-3 min-h-60;
      @apply text-primary/50 dark-text-primary-7/70;

      .invalid-icon {
        @apply text-4xl;
      }
    }

    .draft-badge {
      @apply flex flex-wrap items-center gap-x-2 gap-y-1 mb-3;
      @apply text-sm;

      > span:first-child {
        @apply px-2 py-0.5 rounded-full;
        @apply bg-primary/10 text-primary dark-bg-primary-7/15 dark-text-primary-7;
      }
    }

    .draft-expires {
      @apply text-primary/50 dark-text-primary-7/70;
    }

    .title {
      @apply text-3xl md:text-4xl font-extrabold;
      @apply text-primary dark-text-primary-7;
      @apply mb-4;
      view-transition-name: article-title;
    }

    .details {
      @apply flex flex-wrap items-center gap-x-3 gap-y-1;
      @apply text-sm text-primary/50 dark-text-primary-7/70;
      @apply mb-4;
      view-transition-name: article-details;

      .time {
        @apply flex items-center;

        svg {
          @apply mr-1;
        }
      }
    }

    .article-image {
      @apply w-full rounded-2xl;

      img {
        view-transition-name: article-hero;
        @apply w-full rounded-2xl;
      }
    }
  }

  .sidebar {
    @apply pl-4 flex-shrink-0 w-80;
    @apply sticky top-4 self-start;
    view-transition-name: article-sidebar;
  }

  @media (max-width: 1200px) {
    .sidebar {
      @apply hidden;
    }

    .article-wrapper {
      @apply important-max-w-unset;
    }
  }
}
</style>
