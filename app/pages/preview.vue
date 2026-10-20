<script setup lang="ts">
import type { Root } from 'hast'
import type { ICatalogItem, IPostDetail } from '~~/types/feed'
import type { SvpDocData, SvpScrollData, SvpThemeData } from '~/utils/preview-protocol'
import { watchDebounced } from '@vueuse/core'
import IconTime from '~icons/mingcute/calendar-2-line'
import { formatPublishedDate } from '~/utils/date'
import { SvpGuest } from '~/utils/preview-protocol'

definePageMeta({ layout: 'preview' })

/** 与 server/api/preview.post.ts 的返回结构对应。 */
interface PreviewRenderResult {
  content: Root
  titleList: ICatalogItem[]
  heroUrl: string | null
  heroThumbnailUrl: string | null
}

const colorMode = useColorMode()

const article = ref<IPostDetail | null>(null)
const formattedDate = computed(() => formatPublishedDate(article.value?.publishedAt))

// 最近一次收到的文档（连同其信封 id，用于 ack）；防抖后再走服务端渲染。
const pending = ref<{ data: SvpDocData, id: string } | null>(null)

let guest: SvpGuest | null = null

async function renderDoc(data: SvpDocData, envId: string) {
  const doc = data.doc
  try {
    const res = await $fetch<PreviewRenderResult>('/api/preview', {
      method: 'POST',
      body: { markdown: doc.markdown, heroId: doc.heroId, heroEtag: doc.heroEtag },
    })
    article.value = {
      id: 0,
      type: doc.type,
      title: doc.title,
      summary: doc.summary,
      slug: doc.slug,
      tags: doc.tags,
      categoryName: doc.categoryName,
      commentsCount: 0,
      likesCount: 0,
      viewsCount: 0,
      heroUrl: res.heroUrl,
      heroBlurHash: null,
      mood: doc.mood,
      weather: doc.weather,
      publishedAt: doc.publishedAt ?? new Date().toISOString(),
      content: res.content,
      titleList: res.titleList,
      heroThumbnailUrl: res.heroThumbnailUrl,
    }
    guest?.ack(data.seq, envId)
  } catch (e) {
    guest?.sendError(e instanceof Error ? e.message : String(e))
  }
}

watchDebounced(
  pending,
  (p) => {
    if (p) renderDoc(p.data, p.id)
  },
  { debounce: 300 },
)

// ── 双向滚动同步 ─────────────────────────────────────────
// 外层文档不滚动，滚动发生在页面自身的容器 .preview-page 上。
// rAF 合帧发送（每帧至多一次，跟手）；应用守卫抑制回声：刚把编辑器推来的位置
// 应用到本端后，本端因此触发的 scroll 事件在一小段时间内不再回传，避免乒乓。
const scrollRoot = ref<HTMLElement | null>(null)
const SCROLL_ECHO_GUARD_MS = 160
let scrollApplyingUntil = 0
let scrollRaf = 0

function applyScroll(ratio: number) {
  const el = scrollRoot.value
  if (!el) {
    return
  }
  scrollApplyingUntil = Date.now() + SCROLL_ECHO_GUARD_MS
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = max > 0 ? ratio * max : 0
}

function onContainerScroll() {
  // 刚应用过编辑器推来的滚动 → 回声，不回传
  if (Date.now() < scrollApplyingUntil) {
    return
  }
  if (scrollRaf) {
    return
  }
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const el = scrollRoot.value
    if (!el) {
      return
    }
    const max = el.scrollHeight - el.clientHeight
    guest?.sendScroll(max > 0 ? el.scrollTop / max : 0)
  })
}

// ── 内部链接拦截 ────────────────────────────────────────
function onContentClick(e: MouseEvent) {
  const a = (e.target as HTMLElement | null)?.closest('a')
  if (!a) {
    return
  }
  const href = a.getAttribute('href') || ''
  // 锚点跳转（#h-xxx）在预览内自然滚动，放行
  if (!href || href.startsWith('#')) {
    return
  }
  let internal = false
  try {
    internal = new URL(href, location.href).origin === location.origin
  } catch {
    internal = false
  }
  // 站内链接拦截回传给编辑器（外链由渲染器加的 target=_blank 自行新标签打开）
  if (internal) {
    e.preventDefault()
    guest?.sendNav(href, true)
  }
}

onMounted(() => {
  guest = new SvpGuest({ capabilities: ['theme', 'scroll', 'nav'] })
  guest.on((env) => {
    switch (env.kind) {
      case 'host:doc':
        pending.value = { data: env.data as SvpDocData, id: env.id }
        break
      case 'host:theme':
        colorMode.preference = (env.data as SvpThemeData).mode
        break
      case 'host:scroll':
        applyScroll((env.data as SvpScrollData).ratio)
        break
      default:
        break
    }
  })
  guest.start()
  scrollRoot.value?.addEventListener('scroll', onContainerScroll, { passive: true })
})

onBeforeUnmount(() => {
  guest?.stop()
  guest = null
  scrollRoot.value?.removeEventListener('scroll', onContainerScroll)
})
</script>

<template>
  <!--
    带上 `articles-page-wrapper` 类：CommonArticleRender / SiteToTopButton 等组件
    用 document.querySelector('.articles-page-wrapper') 定位滚动容器（且用了非空断言），
    复用同一容器既避免其崩溃，又让 active-title 检测落在正确的滚动元素上。
    该类的样式在 blog/index.vue 里是 scoped 的，不会影响本页布局。
  -->
  <div ref="scrollRoot" class="preview-page articles-page-wrapper">
    <ClientOnly>
      <article v-if="article" class="article-wrapper" @click="onContentClick">
        <div class="header">
          <h1 class="title">
            {{ article.title || '无标题' }}
          </h1>
          <div class="details">
            <div class="time">
              <IconTime />
              {{ formattedDate }}
            </div>
          </div>
        </div>
        <div v-if="article.heroUrl" class="article-image">
          <img :src="article.heroUrl" alt="">
        </div>
        <CommonArticleRender :article="article.content" />
      </article>
      <div v-else class="preview-empty">
        <div class="i-mingcute-edit-4-line" />
        <span>开始写作，这里会实时呈现预览</span>
      </div>
    </ClientOnly>
  </div>
</template>

<style lang="scss" scoped>
.preview-page {
  // 自身即滚动容器：固定满屏高 + 纵向滚动（外层文档/app 根都 overflow:hidden）
  @apply h-100dvh overflow-y-auto;
  @apply w-full flex justify-center items-start;
  @apply px-4 py-6 sm:px-6 sm:py-8;
}

.article-wrapper {
  @apply w-full max-w-856px;
  @apply bg-light dark-bg-dark px-5 py-5 md:px-8 md:py-8;
  @apply sm:rounded-8 gap-y-5 flex flex-col;
  @apply sm:shadow-2xl general-shadow;

  word-wrap: break-word;

  .title {
    @apply text-3xl md:text-4xl font-extrabold;
    @apply text-primary dark-text-primary-7;
    @apply mb-4;
  }

  .details {
    @apply flex items-center gap-x-2;
    @apply text-sm text-primary/50 dark-text-primary-7/70;
    @apply mb-4;

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
      @apply w-full rounded-2xl;
    }
  }
}

.preview-empty {
  @apply w-full max-w-856px;
  @apply flex flex-col items-center justify-center gap-3;
  @apply min-h-60vh text-primary/40 dark-text-primary-7/40;

  > div {
    @apply text-4xl;
  }

  span {
    @apply text-sm;
  }
}
</style>
