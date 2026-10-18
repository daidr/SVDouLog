import type { H3Event } from 'h3'
import type { IPostDetail } from '~~/types/feed'
import type { SvPostDetail } from '../../utils/sv'
import { toPostDetail } from '../../utils/post-detail'
import { clearUnlockCookie, getUnlockToken, UNLOCK_TOKEN_HEADER } from '../../utils/post-unlock'
import { SV_CACHE, svCacheMaxAge } from '../../utils/sv-cache'
import { readerHeaders } from '../../utils/sv-client'
import { defineCountableCachedEventHandler } from '../utils/countable-cache-handler'

async function fetchDetail(event: H3Event, id: number, token?: string): Promise<IPostDetail> {
  const { record, recordAsync, getRecords } = createRecord()
  try {
    const result = await recordAsync('fetch', () => $fetch<SvPostDetail>(
      `/api/posts/${id}`,
      {
        baseURL: useRuntimeConfig(event).apiEntry,
        headers: token ? { ...readerHeaders(event), [UNLOCK_TOKEN_HEADER]: token } : undefined,
      },
    ))
    return { ...toPostDetail(result, record), duration: getRecords() }
  } catch (e) {
    // 后端的 404 涵盖不存在、草稿和私密；其余是后端故障，如实报 502，页面据此显示出错页而不是 404
    if ((e as { statusCode?: number }).statusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'not found' })
    }
    console.error(e)
    throw createError({ statusCode: 502, statusMessage: 'upstream error' })
  }
}

/**
 * 所有读者共用的那份详情：不带任何读者身份回源，设了访问密码的拿到的就是锁定形态，
 * 可以放心进共享缓存。
 */
const sharedDetail = defineCountableCachedEventHandler(
  event => fetchDetail(event, Number(getRouterParam(event, 'id'))),
  {
    name: SV_CACHE.post,
    // 固定成文章 id：同一篇不论带什么 query 都落在同一个键上（失效策略见 server/utils/sv-cache.ts）
    getKey: event => getRouterParam(event, 'id') ?? '',
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)

/**
 * 详情代理 —— 调 story-verse `/api/posts/:id`，把 markdown 正文转成 hast，
 * 再附上 TOC 和媒体 URL。后端的 getPublic 已强制 status='published' 且非
 * private，404 / draft / private 都被它吞成 404。
 *
 * 读者解锁过这篇（有它的解锁 cookie）时绕开共享缓存，带着 token 单独回源，响应禁止
 * 任何缓存。token 失效（过期、改了密码、密码已清除）就删掉 cookie，回到共享的那份。
 */
export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'id') ?? ''
  if (!/^[1-9]\d*$/.test(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'ID should be an integer' })
  }
  const id = Number(raw)
  const token = getUnlockToken(event, id)
  if (!token) return sharedDetail(event)

  setResponseHeader(event, 'cache-control', 'private, no-store')
  const detail = await fetchDetail(event, id, token)
  if (detail.locked || !detail.passwordProtected) clearUnlockCookie(event, id)
  return detail
})
