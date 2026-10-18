import type { Element, RootContent, Text } from 'hast'

import PartCallout from './callout.vue'
import PartCodeBlock from './codeBlock.vue'
import PartDetails from './details.vue'
import PartElement from './element.vue'
import PartImage from './image.vue'
import PartTable from './table.vue'

// 轮播（带 motion-v 动画）和 GitHub 卡片只出现在少数文章里，拆成独立 chunk，
// 没用到它们的文章页不必下载
const PartGallery = defineAsyncComponent(() => import('./gallery.vue'))
const PartGithubCard = defineAsyncComponent(() => import('./githubCard.vue'))

const CALLOUT_CLASSES = ['custom-block-tip', 'custom-block-info', 'custom-block-warning', 'custom-block-danger']

function classNameIncludes(node: Element, className: string) {
  return typeof node.properties?.className === 'object' && node.properties?.className?.includes(className)
}

/**
 * 选择渲染该 hast 节点的 Vue 组件。
 *
 * 派发顺序按"特异性"由窄到宽：
 *   1. `<pre>` —— markdown-it 渲染代码块默认产物；codeBlock 组件内部按
 *      code.className 取语言并走 shiki 高亮
 *   2. `<table>` —— 套一层 `.table-container` 让现有横向滚动 + 圆角样式生效
 *   3. `<img>` —— 单图走 ImageZoom（点击放大）
 *   4. `<div class="custom-block-gallery">` —— `:::gallery` 容器，渲染轮播
 *   5. `<div class="wp-block-mdx-github">` —— 兼容历史 WP 短代码（markdown
 *      内容里通常不会出现，保留是为了文本化迁移时不破图）
 *   6. `:::tip|info|warning|danger` 提示块 / `:::details` 折叠块 —— 补图标与
 *      按读者语言的默认标题
 *   7. 其他 —— PartElement，按 hast 透传
 */
function switchComponent(node: Element) {
  if (node.tagName === 'pre') {
    return PartCodeBlock
  }
  if (node.tagName === 'table') {
    return PartTable
  }
  if (node.tagName === 'img') {
    return PartImage
  }
  if (node.tagName === 'div' && classNameIncludes(node, 'custom-block-gallery')) {
    return PartGallery
  }
  if (node.tagName === 'div' && classNameIncludes(node, 'custom-block-github')) {
    return PartGithubCard
  }
  if (node.tagName === 'div' && CALLOUT_CLASSES.some(c => classNameIncludes(node, c))) {
    return PartCallout
  }
  if (node.tagName === 'details' && classNameIncludes(node, 'custom-block-details')) {
    return PartDetails
  }
  return PartElement
}

export default defineComponent((props) => {
  const filteredNodes = computed(() => {
    return props.nodes.filter(node => node.type === 'element' || node.type === 'text') as (Element | Text)[]
  })
  return () => {
    return filteredNodes.value.map((node) => {
      if (node.type === 'text') return node.value
      const Comp = switchComponent(node)
      return h(Comp, { node })
    })
  }
}, {
  props: {
    nodes: {
      type: Array as PropType<RootContent[]>,
      required: true,
    },
  },
})
