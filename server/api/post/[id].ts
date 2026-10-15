import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import type { IPostDetail } from '~~/types/feed'
import { handleArticleHeading, handleExtraImageLink, preHandleArticleContent } from '../../utils/article-content'
import { renderMarkdown } from '../../utils/markdown'
import type { SvPostDetail } from '../../utils/sv'
import { buildMediaUrl } from '../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'
import { defineCountableCachedEventHandler } from '../utils/countable-cache-handler'

const { apiEntry } = useRuntimeConfig()

/**
 * 详情代理 —— 调 story-verse `/api/posts/:id`，把 markdown 正文转成 hast，
 * 再附上 TOC 和媒体 URL。后端的 getPublic 已强制 status='published' 且非
 * private，404 / draft / private 都被它吞成 404，这边直接捕获并抛 400。
 */
export default defineCountableCachedEventHandler(
  async (event) => {
    const id = (getRouterParam(event, 'id') as unknown as number) - 0
    if (Number.isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID should be an integer',
      })
    }

    const { record, recordAsync, getRecords } = createRecord()

    try {
      const result = await recordAsync('fetch', () => $fetch<SvPostDetail>(
        `/api/posts/${id}`,
        {
          baseURL: apiEntry,
        },
      ))

      const renderedHtml = record('renderMarkdown', () => renderMarkdown(result.content, { apiEntry, media: result.media }))
      const preHandledHtml = record('preHandle', () => preHandleArticleContent(renderedHtml))
      const parseAst = record('parseTree', () => fromHtmlIsomorphic(preHandledHtml, { fragment: true }))
      const titleList = record('toc', () => handleArticleHeading(parseAst))
      record('extraImageLink', () => handleExtraImageLink(parseAst))

      const publishedAt = result.publishedAt || result.createdAt
      const heroUrl = result.heroId
        ? buildMediaUrl(apiEntry, result.heroId, { webp: true, etag: result.heroEtag })
        : null
      const heroThumbnailUrl = result.heroId
        ? buildMediaUrl(apiEntry, result.heroId, { thumbnail: true, etag: result.heroEtag })
        : null

      const detail: IPostDetail = {
        id: result.id,
        type: result.type,
        title: result.title,
        summary: result.summary || '',
        slug: result.slug,
        tags: result.tags || [],
        categoryName: result.categoryName || '',
        commentsCount: result.commentsCount,
        likesCount: result.likesCount,
        viewsCount: result.viewsCount,
        heroUrl,
        heroThumbnailUrl,
        heroBlurHash: result.heroBlurHash,
        mood: result.mood,
        weather: result.weather,
        publishedAt,
        content: parseAst,
        titleList,
        duration: getRecords(),
      }

      return detail
    } catch (e) {
      console.error(e)
      throw createError({
        statusCode: 400,
        statusMessage: 'not found',
      })
    }
  },
  {
    name: SV_CACHE.post,
    // 固定成文章 id，webhook 才能按 id 精准失效（见 server/utils/sv-cache.ts）
    getKey: event => getRouterParam(event, 'id') ?? '',
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)
