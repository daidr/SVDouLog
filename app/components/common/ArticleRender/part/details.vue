<script setup lang="ts">
import type { Element, ElementContent } from 'hast'
import ArrowIcon from '~icons/mingcute/right-line'

const props = defineProps<{ node: Element }>()

const { t } = useI18n()

function isSummary(node: ElementContent): node is Element {
  return node.type === 'element' && node.tagName === 'summary'
}

/** 作者写了标题时 markdown 端输出 `<summary>`；没写就用默认标题 */
const summaryNode = computed(() => props.node.children.find(isSummary) ?? null)
const bodyNodes = computed(() => props.node.children.filter(n => !isSummary(n)))
</script>

<template>
  <details class="custom-block custom-block-details">
    <summary>
      <ArrowIcon class="custom-block-icon" aria-hidden="true" />
      <span>
        <CommonArticleRenderPartEntry v-if="summaryNode" :nodes="summaryNode.children" />
        <template v-else>{{ t('article_block.details') }}</template>
      </span>
    </summary>
    <div class="custom-block-body">
      <CommonArticleRenderPartEntry :nodes="bodyNodes" />
    </div>
  </details>
</template>

<style lang="scss">
// 不用 scoped：折叠块里的内容由 PartEntry 渲染，选择器要能下探
article.blog-article-wrapper details.custom-block-details {
  @apply my-5 rounded-2xl border-2 border-primary-2 dark-border-primary-4;

  > summary {
    @apply flex items-center gap-x-2 px-5 py-3 cursor-pointer select-none list-none;
    @apply font-bold text-primary-4 dark-text-primary-7;
    @apply rounded-2xl transition-colors;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      @apply bg-primary-1/50 dark-bg-primary-2/50;
    }

    .custom-block-icon {
      @apply text-lg flex-shrink-0 transition-transform motion-reduce:transition-none;
    }
  }

  &[open] > summary {
    @apply rounded-b-none;

    .custom-block-icon {
      @apply rotate-90;
    }
  }

  > .custom-block-body {
    @apply px-5 pb-1;

    > p:first-child {
      @apply mt-0;
    }

    > ul,
    > ol {
      @apply my-3;
    }
  }
}
</style>
