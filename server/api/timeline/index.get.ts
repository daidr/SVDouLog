import type { ITimelineSummary } from '~~/types/feed'
import type { SvArchiveSummary } from '../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

/** 按年月归档的目录：有公开文章的年份、月份和各自的文章数（按站点时区切月） */
export default cachedEventHandler(
  async (): Promise<ITimelineSummary> => {
    const result = await $fetch<SvArchiveSummary>('/api/flow/archive', {
      baseURL: apiEntry,
      query: { tz: SITE_TIME_ZONE },
    })
    return { total: result.total, years: result.years }
  },
  {
    name: SV_CACHE.timeline,
    swr: true,
    maxAge: svCacheMaxAge(60),
    getKey: () => 'summary',
  },
)
