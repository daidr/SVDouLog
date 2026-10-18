<script setup lang="ts">
import type { IFlowItem, ISeriesPost } from '~~/types/feed'
import IconComment from '~icons/mingcute/comment-line'
import IconEye from '~icons/mingcute/eye-2-line'
import IconHeart from '~icons/mingcute/heart-line'
import IconPin from '~icons/mingcute/pin-line'
import { formatPublishedDate } from '~/utils/date'

/** 系列页的文章不带阅读数、分类、标签和置顶，对应的位置就不显示 */
type ArticleListItem = ISeriesPost & Partial<Pick<IFlowItem, 'pin' | 'tags' | 'viewsCount' | 'categoryName' | 'categorySlug'>>

const props = defineProps<{
  article: ArticleListItem
  /** 系列页按系列顺序给文章编号 */
  index?: number
}>()

const { t } = useI18n()

// story-verse 的 publishedAt 是 ISO 字符串，用 locale-fixed formatter 输出
// `YYYY年M月D日`，确保 SSR / client 渲染一致（详见 ~/utils/date 注释）。
const formattedDate = computed(() => formatPublishedDate(props.article.publishedAt))
</script>

<template>
  <!-- 整张卡片可点：标题链接的 ::after 铺满卡片；分类 / 标签是独立链接，叠在它上面 -->
  <div class="article-item" :data-post-path="postPath(article)">
    <div class="left">
      <h3 class="title">
        <a class="title-link" :href="postPath(article)">
          <span v-if="index" class="index">{{ index }}.</span>{{ article.title }}
        </a>
      </h3>
      <div class="details">
        <div v-if="article.pin" class="detail-item pinned" :title="t('global.pinned')">
          <IconPin :aria-label="t('global.pinned')" />
        </div>
        <div class="detail-item">
          {{ formattedDate }}
        </div>
        <NuxtLink
          v-if="article.categorySlug" class="detail-item term-link"
          :to="`/blog/category/${encodeURIComponent(article.categorySlug)}`" @click.stop
        >
          {{ article.categoryName }}
        </NuxtLink>
        <NuxtLink
          v-for="tag of article.tags?.slice(0, 1)" :key="tag"
          class="detail-item term-link" :to="`/blog/tag/${encodeURIComponent(tag)}`" @click.stop
        >
          #{{ tag }}
        </NuxtLink>
        <div v-if="article.viewsCount !== undefined" class="detail-item">
          <IconEye />
          <span>{{ article.viewsCount }}</span>
        </div>
        <div class="detail-item">
          <IconHeart />
          <span>{{ article.likesCount }}</span>
        </div>
        <div class="detail-item">
          <IconComment />
          <span>{{ article.commentsCount }}</span>
        </div>
      </div>
      <div v-if="article.summary" class="summary">
        {{ article.summary }}
      </div>
    </div>
    <div v-if="article.heroUrl" class="right">
      <UiLazyImage
        :src="article.heroUrl"
        :srcset="article.heroSrcset ?? undefined"
        sizes="(max-width: 767.9px) 100vw, 240px"
        :blurhash="article.heroBlurHash ?? ''"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.article-item {
  @apply relative cursor-pointer;
  @apply flex-col md:flex-row flex justify-between rounded-2xl p-2;
  @apply border-gray-200/60 dark-border-gray-700/60 border-1;
  @apply dark-bg-primary-1/80;
  transition:
    border 0.5s linear,
    background-position-x 0.5s ease-out;
  @apply motion-reduce:transition-none;

  background-image: linear-gradient(
    90deg,
    rgba(var(--color-primary-1), 0.3) 0%,
    rgba(var(--color-primary-1), 0.3) 45%,
    transparent 65%,
    transparent 100%
  );

  .dark & {
    background-image: linear-gradient(
    90deg,
    rgba(var(--color-primary-3), 0.5) 0%,
    rgba(var(--color-primary-3), 0.5) 45%,
    transparent 65%,
    transparent 100%
  );
  }

  background-size: 300% 100%;
  background-position-x: 100%;

  &:hover {
    @apply border-primary-2 dark-border-primary-6;
    background-position-x: 0%;
  }

  &.transition-active {
    .title {
      view-transition-name: article-title;
    }
    .details {
      view-transition-name: article-details;
    }
    .right {
      :deep(img) {
        view-transition-name: article-hero;
      }
    }
    .summary {
      view-transition-name: article-summary;
    }
  }

  .left {
    @apply z-1;

    .title {
      @apply text-2xl font-bold text-primary dark-text-primary-7;

      .title-link::after {
        content: '';
        @apply absolute inset-0 z-1 rounded-2xl;
      }

      .index {
        @apply mr-2 text-primary-4/70 dark-text-primary-6;
      }
    }

    .details {
      @apply flex flex-wrap items-center text-primary-4 dark-text-primary-6 text-sm gap-x-3;

      .detail-item {
        @apply flex items-center gap-x-1;

        &.pinned {
          @apply text-primary dark-text-primary-7;
        }
      }

      .term-link {
        @apply relative z-2 transition-colors;

        &:hover {
          @apply text-primary dark-text-primary-8;
        }
      }
    }
    .summary {
      @apply mt-2 overflow-hidden text-ellipsis text-primary-4/80 dark-text-primary-5;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }
  }

  .right {
    @apply flex-grow-0 flex-shrink-0;
    @apply lg:ml-2;
    @apply w-240px h-163px;

    @screen lt-md {
      @apply mt-2 w-full;
    }

    // 封面图与 blurhash 占位统一圆角，避免占位露出方角
    :deep(img),
    :deep(.blurhash) {
      @apply rounded-xl;
    }

    :deep(img) {
      @apply object-cover;
    }
  }
}
</style>
