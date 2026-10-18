import type { IPostDetail, ISeriesNavPost } from '~~/types/feed'
import type { SvPostDetail, SvSeriesNavPost } from './sv'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { handleArticleHeading, handleExtraImageLink, preHandleArticleContent } from './article-content'
import { renderMarkdown } from './markdown'
import { buildMediaSrcset, buildMediaUrl } from './sv'

function mapSeriesNavPost(post: SvSeriesNavPost | null): ISeriesNavPost | null {
  return post ? { id: post.id, title: post.title, slug: post.slug, type: post.type } : null
}

type RecordFn = ReturnType<typeof createRecord>['record']

/**
 * story-verse 的文章详情 → 本站详情：markdown 正文转 hast，附上 TOC 和媒体 URL。
 * 正式文章（`/api/post/:id`）和草稿分享页（`/api/share/:token`）共用，保证两边渲染一致。
 */
export function toPostDetail(result: SvPostDetail, record: RecordFn = (_, fn) => fn()): IPostDetail {
  const renderedHtml = record('renderMarkdown', () => renderMarkdown(result.content, { media: result.media }))
  const preHandledHtml = record('preHandle', () => preHandleArticleContent(renderedHtml))
  const parseAst = record('parseTree', () => fromHtmlIsomorphic(preHandledHtml, { fragment: true }))
  const titleList = record('toc', () => handleArticleHeading(parseAst))
  record('extraImageLink', () => handleExtraImageLink(parseAst))

  const heroUrl = result.heroId
    ? buildMediaUrl(result.heroId, { webp: true, etag: result.heroEtag })
    : null
  const heroThumbnailUrl = result.heroId
    ? buildMediaUrl(result.heroId, { thumbnail: true, etag: result.heroEtag })
    : null

  return {
    id: result.id,
    type: result.type,
    title: result.title,
    summary: result.summary || '',
    slug: result.slug,
    pin: result.pin,
    tags: result.tags || [],
    categoryName: result.categoryName || '',
    categorySlug: result.categorySlug || '',
    commentsCount: result.commentsCount,
    likesCount: result.likesCount,
    viewsCount: result.viewsCount,
    heroUrl,
    heroSrcset: result.heroId ? buildMediaSrcset(result.heroId, { etag: result.heroEtag }) : null,
    heroThumbnailUrl,
    heroBlurHash: result.heroBlurHash,
    heroWidth: result.heroWidth ?? null,
    heroHeight: result.heroHeight ?? null,
    series: result.series
      ? {
          id: result.series.id,
          name: result.series.name,
          slug: result.series.slug,
          index: result.series.index,
          total: result.series.total,
          prev: mapSeriesNavPost(result.series.prev),
          next: mapSeriesNavPost(result.series.next),
        }
      : null,
    mood: result.mood,
    weather: result.weather,
    publishedAt: result.publishedAt || result.createdAt,
    updatedAt: result.updatedAt,
    content: parseAst,
    titleList,
  }
}
