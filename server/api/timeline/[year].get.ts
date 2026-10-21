import type { H3Event } from 'h3'
import type { ITimelinePage } from '~~/types/feed'
import type { SvArchivePostsPage } from '../../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

/** story-verse 这个接口的 size 上限；一年的文章多半一页就能取完 */
const PAGE_SIZE = 100

function readParams(event: H3Event) {
  const year = Number(getRouterParam(event, 'year'))
  let page = Number(getQuery(event).page ?? 1)
  if (!Number.isInteger(page) || page < 1) page = 1
  return { year, page }
}

/**
 * 某一年（站点时区）发布的公开文章，按发布时间倒序；`page` 从 1 起。
 * 年份不合法或这一年没有公开文章时 404。
 */
export default cachedEventHandler(
  async (event): Promise<ITimelinePage> => {
    const { year, page } = readParams(event)
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw createError({ statusCode: 404, statusMessage: 'not found' })
    }

    const result = await $fetch<SvArchivePostsPage>('/api/flow/archive/posts', {
      baseURL: apiEntry,
      query: { tz: SITE_TIME_ZONE, year, page, size: PAGE_SIZE },
    })
    if (result.total === 0) {
      throw createError({ statusCode: 404, statusMessage: 'not found' })
    }

    return {
      list: result.list.map(({ id, type, title, slug, passwordProtected, publishedAt }) => ({ id, type, title, slug, passwordProtected, publishedAt })),
      total: result.total,
      hasNext: result.hasNext,
    }
  },
  {
    name: SV_CACHE.timeline,
    swr: true,
    maxAge: svCacheMaxAge(60),
    getKey: (event) => {
      const { year, page } = readParams(event)
      return `${year}:${page}`
    },
  },
)
