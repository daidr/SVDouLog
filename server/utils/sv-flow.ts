import type { IFlowItem } from '~~/types/feed'
import type { SvPostListItem } from './sv'
import { buildMediaSrcset, buildMediaUrl } from './sv'

/** story-verse `/api/flow` 的一页 */
export interface SvFlowResponse {
  list: SvPostListItem[]
  total: number
  hasNext: boolean
  nextCursor?: string
}

/** 首页时间线和分类 / 标签归档共用的列表项映射 */
export function mapFlowItem(item: SvPostListItem): IFlowItem {
  // listPublic 强制 status='published' 隐含 publishedAt 非空；createdAt 仅作兜底
  const publishedAt = item.publishedAt || item.createdAt

  const heroUrl = item.heroId
    ? buildMediaUrl(item.heroId, { webp: true, etag: item.heroEtag })
    : null

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary || '',
    slug: item.slug,
    pin: item.pin,
    tags: item.tags || [],
    categoryName: item.categoryName || '',
    categorySlug: item.categorySlug || '',
    commentsCount: item.commentsCount,
    likesCount: item.likesCount,
    viewsCount: item.viewsCount,
    heroUrl,
    heroSrcset: item.heroId ? buildMediaSrcset(item.heroId, { etag: item.heroEtag }) : null,
    heroBlurHash: item.heroId ? item.heroBlurHash : null,
    mood: item.mood,
    weather: item.weather,
    publishedAt,
    passwordProtected: item.passwordProtected === true,
  }
}
