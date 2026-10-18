<script setup lang="ts">
import type { IPostDetail } from '~~/types/feed'
import IconTime from '~icons/mingcute/calendar-2-line'
import { formatPublishedDate } from '~/utils/date'

definePageMeta({
  isInArticlePage: true,
})

const slug = useRoute().params.slug as string

if (!/^\d+$/.test(slug)) {
  navigateTo('/404', { replace: true })
}

const ArticleCacheId = inject('ArticleCacheId') as Ref<number>
const ArticleCache = inject('ArticleCache') as Ref<IPostDetail>
const ArticleSummaryCache = inject('ArticleSummaryCache') as Ref<string>

const article = ref<IPostDetail | null>(null)

// 评论区（表单、Turnstile、评论列表）在页面底部，等快滚到时再加载它的代码和数据。
// 不用 hydrate-on-visible：站内文案在 hydrate 前是空的，延迟 hydrate 的组件必然对不上服务端输出
const commentsWrapperEl = ref<HTMLElement>()
const showComments = ref(false)
const { stop: stopCommentsObserver } = useIntersectionObserver(commentsWrapperEl, ([entry]) => {
  if (entry?.isIntersecting) {
    showComments.value = true
    stopCommentsObserver()
  }
}, { rootMargin: '600px 0px' })

if (`${ArticleCacheId.value}` === slug) {
  article.value = ArticleCache.value
} else {
  const { data: _article } = await useFetch<IPostDetail>(
    `/api/post/${slug}`,
  )

  if (!_article.value) {
    navigateTo('/404', { replace: true })
  }

  if (_article.value && typeof _article.value === 'object') {
    article.value = _article.value
  }
}

if (article.value && typeof article.value === 'object') {
  const post = article.value
  const headT = useHeadT()
  const toAbs = useAbsoluteUrl()
  const siteName = useSiteName()
  const authorName = useAuthorName()
  // 封面是站内相对路径（经本站媒体代理）；分享卡片和结构化数据需要绝对地址
  const postUrl = toAbs(`/blog/${post.id}`)
  const heroAbsUrl = post.heroUrl ? toAbs(post.heroUrl) : null
  const modifiedAt = post.updatedAt || post.publishedAt

  usePageSeo({
    title: post.title,
    description: post.summary,
    image: post.heroUrl,
    type: 'article',
  })

  useSeoMeta({
    keywords: post.tags.length ? post.tags.join(',') : undefined,
    articlePublishedTime: post.publishedAt,
    articleModifiedTime: modifiedAt,
    articleSection: post.categoryName || undefined,
    articleTag: post.tags.length ? post.tags : undefined,
    twitterCreator: '@imdaidr',
  })

  const breadcrumbs = computed(() => [
    { name: siteName.value, url: toAbs('/') },
    { name: headT('main_nav.posts'), url: toAbs('/blog') },
    ...post.categorySlug
      ? [{ name: post.categoryName, url: toAbs(`/blog/category/${encodeURIComponent(post.categorySlug)}`) }]
      : [],
    { name: post.title, url: postUrl },
  ])

  useHead({
    script: [
      {
        key: 'ld-article',
        type: 'application/ld+json',
        innerHTML: computed(() => ({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          'mainEntityOfPage': { '@type': 'WebPage', '@id': postUrl },
          'url': postUrl,
          'headline': post.title,
          ...post.summary ? { description: post.summary } : {},
          ...heroAbsUrl ? { image: [heroAbsUrl] } : {},
          'datePublished': post.publishedAt,
          'dateModified': modifiedAt,
          'author': { '@type': 'Person', 'name': authorName.value, 'url': toAbs('/me') },
          ...post.categoryName ? { articleSection: post.categoryName } : {},
          ...post.tags.length ? { keywords: post.tags } : {},
        })),
      },
      {
        key: 'ld-breadcrumb',
        type: 'application/ld+json',
        innerHTML: computed(() => ({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': breadcrumbs.value.map((crumb, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': crumb.name,
            'item': crumb.url,
          })),
        })),
      },
    ],
  })
}

const toTop = inject('toTop') as () => void

/**
 * 阅读量上报：文章详情是共享缓存的，缓存命中不会回源，所以由浏览器在打开后单独上报。
 * 本站服务端带着读者身份转给 story-verse，由它按读者 30 分钟去重。失败静默——计数不该影响阅读。
 */
function reportView(id: number) {
  $fetch(`/api/posts/${id}/view`, { method: 'POST' }).catch(() => {})
}

onMounted(async () => {
  if (!window) return
  if (article.value) reportView(article.value.id)
  const _hash = location.hash
  location.hash = ''
  await nextTick()
  location.hash = _hash
  toTop()
  // 从评论框去登录，回来时直接落到评论区
  if (_hash === '#comments') scrollToComments()
})

const catalogList = computed(() => {
  return article.value?.titleList || []
})

const activeTitleId = ref('')
function setActiveTitle(title: string | null) {
  activeTitleId.value = title || ''
}

const showSidebar = computed(() => catalogList.value.length > 0)

const formattedDate = computed(() => formatPublishedDate(article.value?.publishedAt))

/**
 * 把外层滚动容器（`.articles-page-wrapper`，文章页 fixed 容器内的 y 滚动）
 * 跳到评论区顶部。
 *
 * 不用 element.scrollIntoView：嵌套滚动容器 + fixed wrapper 下其行为不稳，
 * 有时会同时滚动 window，让页面布局抖动。直接拿 `getBoundingClientRect()`
 * 算两个矩形的 top 差，再补 -16px 顶部留白，得到容器内目标 scrollTop。
 *
 * `behavior: 'auto'` 即时跳：本页跨度大（一篇文章可能滚到 7000px+），smooth
 * 动画在中途常被 sticky 重排 / 图片懒加载触发的 layout 变化打断，落点不准；
 * 与同页 `toTop` / `toPrevTop` 行为风格也保持一致。
 */
function scrollToComments() {
  const target = document.querySelector('.comment-section') as HTMLElement | null
  const container = document.querySelector('.articles-page-wrapper') as HTMLElement | null
  if (!target || !container) return
  const targetRect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const top = container.scrollTop + targetRect.top - containerRect.top - 16
  container.scrollTo({ top, behavior: 'auto' })
}
</script>

<script lang="ts">
export default {
  name: 'ArticlePage',
}
</script>

<template>
  <div v-if="article && typeof article === 'object'" class="content-wrapper">
    <main :class="{ 'sidebar-limit': showSidebar }">
      <div class="article-wrapper" :class="{ 'sidebar-limit': showSidebar }">
        <div class="header">
          <div class="title">
            {{ article.title }}
          </div>
          <div class="details">
            <div class="time">
              <IconTime />
              {{ formattedDate }}
            </div>
            <NuxtLink
              v-if="article.categorySlug" class="term-link"
              :to="`/blog/category/${encodeURIComponent(article.categorySlug)}`"
            >
              {{ article.categoryName }}
            </NuxtLink>
            <NuxtLink
              v-for="tag of article.tags" :key="tag"
              class="term-link" :to="`/blog/tag/${encodeURIComponent(tag)}`"
            >
              #{{ tag }}
            </NuxtLink>
          </div>
        </div>
        <UiArticleAISummary
          :article-id="article.id"
          :article-type="article.type"
          :cached-summary="ArticleSummaryCache"
        />
        <div v-if="article.heroUrl" class="article-image">
          <img
            :src="article.heroUrl"
            :srcset="article.heroSrcset ?? undefined"
            sizes="(max-width: 1200px) 100vw, 856px"
            :width="article.heroWidth ?? undefined"
            :height="article.heroHeight ?? undefined"
            fetchpriority="high"
          >
        </div>
        <CommonArticleRender :article="article.content" @active-title="setActiveTitle" />
        <div class="article-actions">
          <SiteLikeButton :post-id="article.id" :initial-count="article.likesCount" />
        </div>
        <SiteSeriesNav v-if="article.series" :series="article.series" />
        <ClientOnly>
          <SiteSubscribeForm class="article-subscribe" />
        </ClientOnly>
      </div>
      <SiteRelatedPosts class="related-wrapper" :post-id="article.id" />
      <div ref="commentsWrapperEl" class="comments-wrapper">
        <LazySiteCommentSection v-if="showComments" :post-id="article.id" />
      </div>
    </main>

    <div v-if="showSidebar" class="sidebar">
      <CommonArticleCatalog
        v-if="catalogList.length"
        :catalog="catalogList"
        :active-title="activeTitleId"
        show-comment-entry
        @jump-to-comments="scrollToComments"
      />
    </div>

    <ClientOnly>
      <Teleport to="body">
        <SiteToTopButton :show-process="true" scroll-el=".articles-page-wrapper" bounding-el=".blog-article-wrapper" />
      </Teleport>
    </ClientOnly>
  </div>
</template>

<style lang="scss" scoped>
.content-wrapper {
  @apply w-full flex;
  @apply text-dark dark-text-light;

  main {
    @apply w-full flex flex-col sm:gap-y-5 <sm:mb-8;

    .sidebar-limit {
      @apply max-w-856px;
    }
  }

  .related-wrapper,
  .comments-wrapper {
    @apply bg-light dark-bg-dark px-5 py-5 md:px-8 md:py-8 w-full;
    @apply sm:rounded-8;
    @apply sm:shadow-2xl general-shadow;
  }

  .comments-wrapper {
    @apply space-y-5;
    view-transition-name: article-comments;
  }

  .article-wrapper {
    @apply bg-light dark-bg-dark px-5 py-5 md:px-8 md:py-8 w-full;
    @apply sm:rounded-8 gap-y-5 flex flex-col;
    @apply sm:shadow-2xl general-shadow;
    view-transition-name: main-wrapper;

    word-wrap: break-word;

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

      .origin:hover,
      .term-link:hover {
        @apply text-primary dark-text-primary-7;
      }

      .term-link {
        @apply transition-colors;
      }
    }

    .article-actions {
      @apply mt-2 flex items-center justify-center;
    }

    .article-subscribe {
      @apply pt-5 border-t border-gray-200/60 dark-border-gray-700/60;
    }

    .article-image {
      @apply w-full rounded-2xl;

      img {
        view-transition-name: article-hero;
        @apply w-full h-auto rounded-2xl;
      }
      // &,
      // :deep(img) {
      //   view-transition-name: article-hero;
      //   @apply w-full rounded-2xl;
      // }
    }
  }

  .sidebar {
    @apply pl-4 flex-shrink-0 w-80;
    // 整列 sticky 让侧栏贴在视口顶部；ArticleSideItem 自身不再 sticky，
    // 由父容器统一控制（未来若再追加 SideItem 不会出现多 sticky 抢位）
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
