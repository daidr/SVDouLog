import type { ISeriesDetail } from '~~/types/feed'
import type { SvSeriesDetail } from '../../utils/sv'
import { buildMediaSrcset, buildMediaUrl } from '../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

/**
 * 系列详情，代理 story-verse `/api/series/by-slug/:slug`：系列信息和它的公开文章（按系列顺序）。
 * 系列不存在或没有公开文章时后端回 404，这边原样抛 404。
 */
export default cachedEventHandler(
  async (event): Promise<ISeriesDetail> => {
    const slug = getRouterParam(event, 'slug', { decode: true }) ?? ''
    if (!slug) {
      throw createError({ statusCode: 404, statusMessage: 'not found' })
    }

    let result: SvSeriesDetail
    try {
      result = await $fetch<SvSeriesDetail>(`/api/series/by-slug/${encodeURIComponent(slug)}`, { baseURL: apiEntry })
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) {
        throw createError({ statusCode: 404, statusMessage: 'not found' })
      }
      throw e
    }

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      description: result.description || '',
      posts: result.posts.map(post => ({
        id: post.id,
        type: post.type,
        title: post.title,
        summary: post.summary || '',
        slug: post.slug,
        commentsCount: post.commentsCount,
        likesCount: post.likesCount,
        heroUrl: post.heroId ? buildMediaUrl(post.heroId, { webp: true, etag: post.heroEtag }) : null,
        heroSrcset: post.heroId ? buildMediaSrcset(post.heroId, { etag: post.heroEtag }) : null,
        heroBlurHash: post.heroId ? post.heroBlurHash : null,
        // 公开文章必然已发布
        publishedAt: post.publishedAt || '',
      })),
    }
  },
  {
    name: SV_CACHE.series,
    swr: true,
    maxAge: svCacheMaxAge(60),
    getKey: event => encodeURIComponent(getRouterParam(event, 'slug', { decode: true }) ?? ''),
  },
)
