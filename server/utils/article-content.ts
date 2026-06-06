import type { Element, ElementContent, Root, RootContent } from 'hast'
import type { ICatalogItem } from '~~/types/feed'
import { pinyin } from '@napi-rs/pinyin'
import slugify from 'slug'

/**
 * 文章正文处理管线的共享步骤。
 *
 * 这些函数原本内联在 `server/api/post/[id].ts`，因为实时预览端点
 * （`server/api/preview.post.ts`）要复用完全一致的处理，抽到这里统一维护，
 * 保证「预览所见」与「正式文章所得」逐字节一致。
 *
 * 完整管线（两处调用方都一样）：
 *   renderMarkdown → preHandleArticleContent → fromHtmlIsomorphic(fragment)
 *     → handleArticleHeading（产出 TOC + 给 heading 注 id）→ handleExtraImageLink
 */

const WARN_ICON
  = '<svg xmlns="http://www.w3.org/2000/svg" class="mdui-icon" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 16a1 1 0 1 0 1 1a1 1 0 0 0-1-1Zm10.67 1.47l-8.05-14a3 3 0 0 0-5.24 0l-8 14A3 3 0 0 0 3.94 22h16.12a3 3 0 0 0 2.61-4.53Zm-1.73 2a1 1 0 0 1-.88.51H3.94a1 1 0 0 1-.88-.51a1 1 0 0 1 0-1l8-14a1 1 0 0 1 1.78 0l8.05 14a1 1 0 0 1 .05 1.02ZM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1Z"/></svg>'

function encodeHtmlAttr(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 对渲染后的 HTML 做几条 douLog 历史保留下来的 patch。
 *
 * 这些规则原本是为旧 WP HTML 设计（短代码、TablePress、md-icon），story-verse
 * 的 markdown 通常不会触发它们；保留是为了：
 *   - 作者在 markdown 中手写 <table> / <script> 时仍按既定方式包装
 *   - 兼容历史富文本片段（迁移时直接粘贴 HTML 也能正常呈现）
 */
export function preHandleArticleContent(html: string) {
  return (
    html
      // 把 <script> 包到自定义元素里延迟挂载，避免 SSR 直接执行
      .replaceAll(/(<script[\s\S]*?<\/script>)/g, (_: any, p1: any) => {
        return `<blog-dynamic-inject data-element="${encodeHtmlAttr(
          p1,
        )}"></blog-dynamic-inject>`
      })
      // TablePress 风格的表格外包一层容器（如果作者贴了原 HTML）
      .replaceAll(
        /(<table id="tablepress-\d+" class="tablepress tablepress-id-\d+">[\s\S]*<\/table>)/g,
        (_: any, p1: any) => {
          return `<div class="table-container">${p1}</div>`
        },
      )
      // 兼容旧文章里 mdui 的 warning 图标语法
      .replaceAll(
        '<i class="mdui-icon material-icons">warning</i><br>',
        WARN_ICON,
      )
  )
}

export function handleArticleHeading(root: Root) {
  const titleNodes: Element[] = []
  let minTitleLevel = 6
  const traverse = (node: ElementContent | RootContent) => {
    if (node.type !== 'element') return
    if (node.tagName === 'h1' || node.tagName === 'h2' || node.tagName === 'h3' || node.tagName === 'h4' || node.tagName === 'h5' || node.tagName === 'h6') {
      const level = Number(node.tagName.replace('h', ''))
      if (level < minTitleLevel) minTitleLevel = level
      titleNodes.push(node)
    }
    if (node.children) {
      node.children.forEach(traverse)
    }
  }
  root.children.forEach(traverse)
  const titleList: ICatalogItem[] = []
  const conflictingSlugMap = new Map<string, number>()

  for (const title of titleNodes) {
    const level = Number(title.tagName.replace('h', ''))
    const content = hastToPureText(title)
    let slug = slugify(pinyin(content).join('-'))
    const conflictingSlugCount = conflictingSlugMap.get(slug) || 0
    conflictingSlugMap.set(slug, conflictingSlugCount + 1)
    if (conflictingSlugCount > 0) {
      slug = `${slug}-${conflictingSlugCount}`
    }

    const titleItem: ICatalogItem = {
      key: (title.properties.id = `h-${slug}`),
      title: content,
      level: level - minTitleLevel,
    }
    titleList.push(titleItem)
  }

  return titleList
}

// 移除图片外层的 a 标签（让点击图片走预览，不被锚跳走）
export function handleExtraImageLink(root: Root) {
  const traverse = (node: ElementContent | RootContent) => {
    if (node.type !== 'element') return
    const first = node.children[0]
    if (node.tagName === 'a' && node.children.length === 1 && first && first.type === 'element' && first.tagName === 'img') {
      const img = first
      node.properties = img.properties
      node.children = img.children
      node.tagName = img.tagName
      return
    }
    if (node.children) {
      node.children.forEach(traverse)
    }
  }
  root.children.forEach(traverse)
}
