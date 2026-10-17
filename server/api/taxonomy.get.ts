import type { ITaxonomy } from '~~/types/feed'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'
import { loadTaxonomy } from '../utils/sv-taxonomy'

const { apiEntry } = useRuntimeConfig()

/** 分类与标签索引：有公开文章的分类和全部公开标签，各带文章数 */
export default cachedEventHandler(
  async (): Promise<ITaxonomy> => loadTaxonomy(apiEntry),
  {
    name: SV_CACHE.taxonomy,
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)
