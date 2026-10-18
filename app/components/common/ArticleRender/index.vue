<script setup lang="ts">
import type { Root } from 'hast'
import './wp-block-gallery.scss'

defineProps<{
  article: Root
}>()

const emit = defineEmits<{
  (event: 'activeTitle', payload: string | null): void
}>()

const onScroll = throttleAndDebounce(checkActiveTitle, 100)

const ArticleContentWrapperRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 文章滚动容器
  const articlePageWrapper = document.querySelector('.articles-page-wrapper')

  // 判断当前激活的标题
  requestAnimationFrame(checkActiveTitle)

  // 监听滚动事件
  articlePageWrapper!.addEventListener('scroll', onScroll)
})

onUnmounted(() => {
  const articlePageWrapper = document.querySelector('.articles-page-wrapper')
  articlePageWrapper!.removeEventListener('scroll', onScroll)
})

/**
 * 正文内的页内锚点（脚注 `[^1]` 及其回跳链接，作者手写的 `#xxx`）自己接管：
 * 页面滚动发生在 `.articles-page-wrapper` 这个 fixed 容器里，浏览器默认的 hash
 * 跳转会把目标顶到容器最上沿、还会在 URL 留下 hash（刷新时被文章页的 hash 处理
 * 再跳一次）。这里换算出容器内的 scrollTop 直接跳，目标落在离顶部一段距离的位置，
 * 前后文都看得见；目标在收起的折叠块里时先把折叠块展开。
 */
const ANCHOR_TOP_GAP = 96

function onArticleClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = (event.target as HTMLElement | null)?.closest?.('a')
  const href = anchor?.getAttribute('href')
  if (!href || !href.startsWith('#') || href.length < 2) return
  let id = href.slice(1)
  try {
    id = decodeURIComponent(id)
  } catch {
    // 非法转义就按原样找
  }
  const target = document.getElementById(id)
  const wrapper = ArticleContentWrapperRef.value
  if (!target || !wrapper?.contains(target)) return
  event.preventDefault()
  scrollToArticleTarget(target)
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
let flashed: HTMLElement | null = null

function scrollToArticleTarget(target: HTMLElement) {
  for (let details = target.closest('details'); details; details = details.parentElement?.closest('details') ?? null) {
    details.open = true
  }
  const container = document.querySelector('.articles-page-wrapper') as HTMLElement | null
  if (!container) return
  const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - ANCHOR_TOP_GAP
  container.scrollTo({ top, behavior: 'auto' })

  // 目标短暂高亮：落点靠近文末时容器滚不到预定位置，靠它找到是哪一条
  flashed?.classList.remove('anchor-flash')
  clearTimeout(flashTimer)
  void target.offsetWidth
  target.classList.add('anchor-flash')
  flashed = target
  flashTimer = setTimeout(() => target.classList.remove('anchor-flash'), 1600)
}

onBeforeUnmount(() => clearTimeout(flashTimer))

let titles = [] as HTMLHeadingElement[]

function checkActiveTitle() {
  if (!ArticleContentWrapperRef.value) return
  const articlePageWrapper = document.querySelector('.articles-page-wrapper')
  if (titles.length === 0) {
    titles = [
      ...ArticleContentWrapperRef.value.querySelectorAll(
        'h1, h2, h3, h4, h5, h6',
      ),
    ] as HTMLHeadingElement[]
  }
  const scrollY = articlePageWrapper?.scrollTop || 0
  const innerHeight = articlePageWrapper!.clientHeight
  const offsetHeight = articlePageWrapper!.scrollHeight
  const isBottom = Math.abs(scrollY + innerHeight - offsetHeight) < 1
  if (titles.length && isBottom) {
    emit('activeTitle', titles[titles.length - 1].id)
    return
  }
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]
    const nextTitle = titles[i + 1]
    const [isActive, id] = isTitleActive(i, title, nextTitle)
    if (isActive) {
      emit('activeTitle', id)
      return
    }
  }
}
function getTitleTop(title: HTMLHeadingElement): number {
  return title.offsetTop + 130
}
function isTitleActive(
  index: number,
  title: HTMLHeadingElement,
  nextTitle: HTMLHeadingElement | undefined,
): [boolean, string | null] {
  const articlePageWrapper = document.querySelector('.articles-page-wrapper')
  const scrollTop = articlePageWrapper?.scrollTop || 0
  if (index === 0 && scrollTop === 0) {
    return [true, null]
  }
  if (scrollTop < getTitleTop(title)) {
    return [false, null]
  }
  if (!nextTitle || scrollTop < getTitleTop(nextTitle)) {
    return [true, title.id]
  }
  return [false, null]
}
</script>

<template>
  <article ref="ArticleContentWrapperRef" class="blog-article-wrapper" @click="onArticleClick">
    <CommonArticleRenderPartEntry :nodes="article.children" />
  </article>
</template>

<style lang="scss" scoped>
article.blog-article-wrapper {
  @apply bg-light dark-bg-dark;
  @apply text-dark dark-text-light/80;

  :deep(blockquote) {
    @apply ml-0 pl-4 relative;
    @apply text-primary-4 dark-text-primary-7;

    &:before {
      @apply absolute top-0 left-0 bottom-0 w-1.5;
      @apply bg-primary-4 dark-bg-primary-7 rounded-full;
      content: '';
    }

    .mdui-icon {
      @apply text-xl;
    }
  }

  :deep(blockquote.mdx-warning) {
    @apply text-red-700/80 dark-text-red-500/80;
    &:before {
      @apply bg-red-700/80 dark-text-red-500/80;
    }
  }

  :deep(p) {
    @apply my-3 leading-32px;
  }

  :deep(h2) {
    @apply text-3xl font-bold;
    @apply my-7;
  }

  :deep(h3) {
    @apply text-2xl font-bold;
    @apply my-7;
  }

  :deep(h4) {
    @apply text-xl font-bold;
    @apply my-7;
  }

  :deep(a) {
    @apply text-primary-4 dark-text-primary-7;
    @apply underline;
  }

  :deep(mark) {
    @apply text-primary-4 dark-text-primary-7;
  }

  :deep(code:not(.shiki code)) {
    @apply bg-primary-1/70 dark-bg-primary-2 px-1 rounded-md text-primary-7 dark-text-primary-8;
  }

  :deep(.table-container),
  :deep(.mdui-table-fluid) {
    @apply border-2 border-primary-2 dark-border-primary-4 my-3;
    @apply rounded-8px overflow-y-hidden;

    table {
      @apply mx-0 border-none border-separate;
      @apply relative w-full bg-light dark-bg-dark;
      border-spacing: 0;

      thead {
        @apply bg-primary-1/80;
      }

      td,
      th {
        @apply relative box-border;
        @apply px-28px py-12px;
        @apply text-left align-middle;
      }

      th {
        @apply text-primary-text font-bold text-sm leading-32px;
        @apply overflow-hidden whitespace-nowrap text-ellipsis;
      }

      td:first-child,
      th:first-child {
        @apply pr-0 pl-24px;
      }

      tbody td,
      tbody th,
      thead th {
        @apply border-b-2 border-primary-2 dark-border-primary-4;
      }

      tbody tr {
        @apply transition-colors relative;
      }

      tbody tr:hover {
        @apply bg-primary-1/50 dark-bg-primary-2/50;
      }

      tbody tr:last-child td,
      tbody tr:last-child th {
        @apply border-none;
      }
    }
  }

  :deep(sup.footnote-ref) {
    @apply text-xs leading-none;

    a {
      @apply no-underline font-bold px-0.5 rounded;
    }
  }

  :deep(hr.footnotes-sep) {
    @apply mt-12 mb-6 border-0 border-t-2 border-primary-2 dark-border-primary-4;
  }

  :deep(section.footnotes) {
    @apply text-sm;

    ol.footnotes-list {
      @apply my-4;
    }

    p {
      @apply my-0 leading-26px;
    }

    a.footnote-backref {
      @apply no-underline ml-0.5;
    }
  }

  :deep(.anchor-flash) {
    @apply rounded-md;
    animation: anchor-flash 1.6s ease-out;
  }

  :deep(.cp_embed_wrapper) {
    @apply my-3;
  }

  :deep(img) {
    @apply my-3;
    @apply rounded-2xl;
  }

  :deep(img:not(.wp-smiley)) {
    @apply cursor-pointer;
    // 配合后端回填的 width/height 属性：浏览器据此预留 aspect-ratio 盒子，
    // 图片加载前不塌陷 / 不撑开 → 零布局抖动。height:auto 让其按容器宽等比缩放。
    // 排除 .wp-smiley：表情符号靠全局 height:1em 固定方寸，不能被 h-auto 覆盖。
    @apply max-w-full h-auto;
  }

  :deep(.wp-block-gallery .wp-block-image) {
    @apply m-0;

    img {
      @apply m-0;
    }
  }

  :deep(ol) {
    @apply ml-3.5rem relative space-y-2 my-8;
    counter-reset: ol-step-counter;

    & > li {
      counter-increment: ol-step-counter;
      &::before {
        @apply bg-primary-1/70 dark-bg-primary-2 text-primary-7 dark-text-primary-8 rounded-full absolute;
        @apply inline-flex flex-shrink-0 h-1.5rem w-1.5rem justify-center;
        @apply -ml-2.5rem mr-1rem;
        content: counter(ol-step-counter);
        transform: translateY(0.1875rem);
      }
    }
  }

  :deep(ul) {
    @apply ml-3.5rem relative space-y-2 my-8;

    & > li {
      &::before {
        @apply h-0.5rem w-0.5rem inline-flex content-empty;
        @apply bg-primary dark-bg-primary-8 rounded-full absolute;
        @apply -ml-1.5rem mr-0.5rem;
        transform: translateY(0.625rem);
      }
    }
  }
}

@keyframes anchor-flash {
  0%,
  40% {
    background-color: rgba(var(--color-primary-2), 0.9);
  }
  100% {
    background-color: transparent;
  }
}
</style>
