import type { ISeriesItem } from '~~/types/feed'
import type { SvSeriesListItem } from '../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

/**
 * 系列列表，代理 story-verse `/api/series`：只含有公开文章的系列，按最近一篇的发布时间倒序。
 */
export default cachedEventHandler(
  async (): Promise<ISeriesItem[]> => {
    const list = await $fetch<SvSeriesListItem[]>('/api/series', { baseURL: apiEntry })
    return list.map(item => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      postCount: item.postCount,
      // 有公开文章才会出现在列表里，lastPublishedAt 必然非空
      lastPublishedAt: item.lastPublishedAt || '',
    }))
  },
  {
    name: SV_CACHE.seriesList,
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)
