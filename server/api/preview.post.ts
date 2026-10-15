import type { Root } from 'hast'
import type { ICatalogItem } from '~~/types/feed'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { handleArticleHeading, handleExtraImageLink, preHandleArticleContent } from '../utils/article-content'
import { renderMarkdown } from '../utils/markdown'
import { buildMediaUrl } from '../utils/sv'

/** 编辑器实时预览发来的文档（仅取渲染所需字段，其余元数据由预览页自行持有）。 */
interface PreviewRenderBody {
  markdown?: string
  heroId?: number | null
  heroEtag?: string | null
}

export interface PreviewRenderResult {
  content: Root
  titleList: ICatalogItem[]
  heroUrl: string | null
  heroThumbnailUrl: string | null
}

/**
 * 实时预览渲染端点。
 *
 * 与 `server/api/post/[id].ts` 走完全一致的正文处理管线（共享自
 * `server/utils/article-content.ts`），保证「预览所见 == 正式文章所得」。
 * 区别仅在于：输入是编辑器发来的未保存 markdown，而非后端已发布文章；且
 * 每次内容都不同，故不做任何缓存。同源调用（iframe 内 DouLog 页面 → 本端点），
 * 无 CORS 问题。
 */
export default defineEventHandler(async (event): Promise<PreviewRenderResult> => {
  const body = await readBody<PreviewRenderBody>(event)
  const markdown = typeof body?.markdown === 'string' ? body.markdown : ''

  const renderedHtml = renderMarkdown(markdown)
  const preHandledHtml = preHandleArticleContent(renderedHtml)
  const content = fromHtmlIsomorphic(preHandledHtml, { fragment: true })
  const titleList = handleArticleHeading(content)
  handleExtraImageLink(content)

  const heroId = typeof body?.heroId === 'number' ? body.heroId : null
  const heroEtag = body?.heroEtag ?? null
  const heroUrl = heroId ? buildMediaUrl(heroId, { webp: true, etag: heroEtag }) : null
  const heroThumbnailUrl = heroId ? buildMediaUrl(heroId, { thumbnail: true, etag: heroEtag }) : null

  return { content, titleList, heroUrl, heroThumbnailUrl }
})
