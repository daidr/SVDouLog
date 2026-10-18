import type { IPostDetail } from '~~/types/feed'
import type { SvPostDetail } from '../../utils/sv'
import { toPostDetail } from '../../utils/post-detail'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'
import { defineCountableCachedEventHandler } from '../utils/countable-cache-handler'

const { apiEntry } = useRuntimeConfig()

/**
 * 详情代理 —— 调 story-verse `/api/posts/:id`，把 markdown 正文转成 hast，
 * 再附上 TOC 和媒体 URL。后端的 getPublic 已强制 status='published' 且非
 * private，404 / draft / private 都被它吞成 404。
 */
export default defineCountableCachedEventHandler(
  async (event) => {
    const id = (getRouterParam(event, 'id') as unknown as number) - 0
    if (Number.isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID should be an integer',
      })
    }

    const { record, recordAsync, getRecords } = createRecord()

    try {
      const result = await recordAsync('fetch', () => $fetch<SvPostDetail>(
        `/api/posts/${id}`,
        {
          baseURL: apiEntry,
        },
      ))

      const detail: IPostDetail = { ...toPostDetail(result, record), duration: getRecords() }

      return detail
    } catch (e) {
      // 后端的 404 涵盖不存在、草稿和私密；其余是后端故障，如实报 502，页面据此显示出错页而不是 404
      if ((e as { statusCode?: number }).statusCode === 404) {
        throw createError({ statusCode: 404, statusMessage: 'not found' })
      }
      console.error(e)
      throw createError({ statusCode: 502, statusMessage: 'upstream error' })
    }
  },
  {
    name: SV_CACHE.post,
    // 固定成文章 id：同一篇不论带什么 query 都落在同一个键上（失效策略见 server/utils/sv-cache.ts）
    getKey: event => getRouterParam(event, 'id') ?? '',
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)
