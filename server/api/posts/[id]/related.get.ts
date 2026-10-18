import type { IRelatedItem } from '~~/types/feed'
import type { SvRelatedItem } from '../../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../../utils/sv-cache'
import { requireIdParam } from '../../../utils/sv-client'

const { apiEntry } = useRuntimeConfig()

/** 文章下方显示几条：两列网格排满两行 */
const LIMIT = 4

/**
 * 相关文章，代理 story-verse `/api/posts/:id/related`。按文章 id 缓存，任意内容或分类变更时整组失效
 * （别的文章改标题、撤回都会影响这里）。文章本身不可见时 story-verse 回 404，这边返回空列表，不影响正文。
 */
export default cachedEventHandler(
  async (event): Promise<IRelatedItem[]> => {
    const id = requireIdParam(event)
    try {
      const list = await $fetch<SvRelatedItem[]>(`/api/posts/${id}/related`, {
        baseURL: apiEntry,
        query: { limit: LIMIT },
      })
      // 独立页面在本站没有路由
      return list.filter(item => item.type !== 'page').map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        slug: item.slug,
        categoryName: item.categoryName || '',
        publishedAt: item.publishedAt || '',
      }))
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404) return []
      throw e
    }
  },
  {
    name: SV_CACHE.related,
    getKey: event => getRouterParam(event, 'id') ?? '',
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)
