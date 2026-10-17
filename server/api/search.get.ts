import type { ISearchItem } from '~~/types/feed'
import type { SvSearchItem, SvSearchResponse } from '../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

const PAGE_SIZE = 10
/** 与 story-verse `/api/posts/search` 的 q 上限一致 */
const MAX_QUERY_LENGTH = 100

function mapItem(item: SvSearchItem): ISearchItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    titleHighlights: item.titleHighlights,
    snippet: item.snippet,
    tags: item.tags || [],
    categoryName: item.categoryName || '',
    // 公开搜索只回 published，publishedAt 必然非空
    publishedAt: item.publishedAt || '',
  }
}

/**
 * 站内搜索，代理 story-verse `/api/posts/search`。只搜文章和随笔：独立页面在本站没有路由。
 * 结果按「查询串 + 页码」缓存，内容变更时随列表一起失效。
 */
export default cachedEventHandler(
  async (event) => {
    const query = getQuery(event)
    const q = String(query.q ?? '').trim().slice(0, MAX_QUERY_LENGTH)
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1)
    if (!q) {
      return { list: [], total: 0, hasNext: false }
    }

    const result = await $fetch<SvSearchResponse>('/api/posts/search', {
      baseURL: apiEntry,
      query: { q, page, size: PAGE_SIZE, type: ['post', 'note'] },
    })
    return {
      list: result.list.map(mapItem),
      total: result.total,
      hasNext: result.hasNext,
    }
  },
  {
    name: SV_CACHE.search,
    swr: true,
    maxAge: svCacheMaxAge(60),
    getKey: (event) => {
      const query = getQuery(event)
      const q = String(query.q ?? '').trim().slice(0, MAX_QUERY_LENGTH)
      // 键里只放规范化后的参数，其它 query 改变不了结果
      return `${encodeURIComponent(q)}:${Number.parseInt(String(query.page ?? '1'), 10) || 1}`
    },
  },
)
