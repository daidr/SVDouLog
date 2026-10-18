<script setup lang="ts">
import type { Element, ElementContent } from 'hast'
import DangerIcon from '~icons/mingcute/alert-octagon-line'
import TipIcon from '~icons/mingcute/bulb-line'
import InfoIcon from '~icons/mingcute/information-line'
import WarningIcon from '~icons/mingcute/warning-line'

const props = defineProps<{ node: Element }>()

const ICONS = {
  tip: TipIcon,
  info: InfoIcon,
  warning: WarningIcon,
  danger: DangerIcon,
} as const

type CalloutKind = keyof typeof ICONS

const { t } = useI18n()

const kind = computed<CalloutKind>(() => {
  const classes = props.node.properties?.className
  const list = Array.isArray(classes) ? classes.map(String) : []
  return (Object.keys(ICONS) as CalloutKind[]).find(k => list.includes(`custom-block-${k}`)) ?? 'info'
})

function isTitle(node: ElementContent): node is Element {
  const classes = node.type === 'element' ? node.properties?.className : null
  return Array.isArray(classes) && classes.includes('custom-block-title')
}

/** 作者写了标题时 markdown 端输出的 `<p class="custom-block-title">`；没写就用默认标题 */
const titleNode = computed(() => props.node.children.find(isTitle) ?? null)
const bodyNodes = computed(() => props.node.children.filter(n => !isTitle(n)))
</script>

<template>
  <div class="custom-block" :class="`custom-block-${kind}`">
    <p class="custom-block-title">
      <component :is="ICONS[kind]" class="custom-block-icon" aria-hidden="true" />
      <span>
        <CommonArticleRenderPartEntry v-if="titleNode" :nodes="titleNode.children" />
        <template v-else>{{ t(`article_block.${kind}`) }}</template>
      </span>
    </p>
    <CommonArticleRenderPartEntry :nodes="bodyNodes" />
  </div>
</template>

<style lang="scss">
// 不用 scoped：块里的段落 / 列表由 PartEntry 渲染，选择器要能下探；
// 以 article.blog-article-wrapper 打头，盖过 ArticleRender 对 p / ul / ol 的通用间距
article.blog-article-wrapper .custom-block {
  &.custom-block-tip,
  &.custom-block-info,
  &.custom-block-warning,
  &.custom-block-danger {
    @apply my-5 px-5 py-1 rounded-2xl border-2;
    border-color: rgba(var(--callout-color), 0.3);
    background-color: rgba(var(--callout-color), 0.06);

    > p {
      @apply my-2.5;
    }

    > .custom-block-title {
      @apply flex items-center gap-x-2 mt-3 mb-1 font-bold;
      color: rgb(var(--callout-color));

      .custom-block-icon {
        @apply text-lg flex-shrink-0;
      }

      code {
        @apply font-normal;
      }
    }

    > ul,
    > ol {
      @apply my-3;
    }
  }

  &.custom-block-info {
    --callout-color: var(--color-primary-5);
  }

  &.custom-block-tip {
    --callout-color: 5, 150, 105;
  }

  &.custom-block-warning {
    --callout-color: 202, 138, 4;
  }

  &.custom-block-danger {
    --callout-color: 220, 38, 38;
  }
}

// 块里的代码块不做手机上的通栏，保留边框和圆角留在块内（折叠块同样适用）
article.blog-article-wrapper .custom-block .shiki {
  @apply mx-0 border-2 rounded-xl;
}

html.dark article.blog-article-wrapper .custom-block {
  &.custom-block-info {
    --callout-color: var(--color-primary-8);
  }

  &.custom-block-tip {
    --callout-color: 52, 211, 153;
  }

  &.custom-block-warning {
    --callout-color: 250, 204, 21;
  }

  &.custom-block-danger {
    --callout-color: 248, 113, 113;
  }
}
</style>
