import type { H3Event } from 'h3'
import type { IArchivePage } from '~~/types/feed'
import type { SvCategory } from '../utils/sv'
import type { SvFlowResponse } from '../utils/sv-flow'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'
import { mapFlowItem } from '../utils/sv-flow'

const { apiEntry } = useRuntimeConfig()

/** 与首页时间线一致，前端按 `page = list.length / size + 1` 滚动加载 */
const PAGE_SIZE = 10

function readQuery(event: H3Event) {
  const query = getQuery(event)
  const category = typeof query.category === 'string' ? query.category : ''
  const tag = typeof query.tag === 'string' ? query.tag : ''
  let page = Number(query.page ?? 1)
  if (!Number.isInteger(page) || page < 1) page = 1
  return { category, tag, page }
}

function notFound() {
  return createError({ statusCode: 404, statusMessage: 'not found' })
}

/**
 * 分类 / 标签归档的一页：`?category=<slug>` 或 `?tag=<name>`，外加 `page`。
 * 代理 story-verse `/api/flow` 的分类 / 标签筛选，排序与首页时间线一致。
 * 分类不存在（或已停用）、标签下没有公开文章时 404。
 */
export default cachedEventHandler(
  async (event): Promise<IArchivePage> => {
    const { category, tag, page } = readQuery(event)
    if (!category === !tag) throw notFound()

    let header: Pick<IArchivePage, 'kind' | 'name' | 'description'>
    let filter: { categoryId: number } | { tag: string }
    if (category) {
      let found: SvCategory
      try {
        found = await $fetch<SvCategory>(`/api/categories/by-slug/${encodeURIComponent(category)}`, { baseURL: apiEntry })
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) throw notFound()
        throw e
      }
      header = { kind: 'category', name: found.name, description: found.description || '' }
      filter = { categoryId: found.id }
    } else {
      header = { kind: 'tag', name: tag, description: '' }
      filter = { tag }
    }

    const result = await $fetch<SvFlowResponse>('/api/flow', {
      baseURL: apiEntry,
      query: { page, size: PAGE_SIZE, ...filter },
    })
    if (tag && result.total === 0) throw notFound()

    return {
      ...header,
      list: result.list.map(mapFlowItem),
      total: result.total,
      hasNext: result.hasNext,
    }
  },
  {
    name: SV_CACHE.archive,
    swr: true,
    maxAge: svCacheMaxAge(60),
    getKey: (event) => {
      const { category, tag, page } = readQuery(event)
      return `${category ? `c:${encodeURIComponent(category)}` : `t:${encodeURIComponent(tag)}`}:${page}`
    },
  },
)
