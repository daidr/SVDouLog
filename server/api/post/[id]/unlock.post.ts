import type { SvPostUnlockResult } from '../../../utils/sv'
import { setUnlockCookie } from '../../../utils/post-unlock'
import { readerHeaders, requireIdParam } from '../../../utils/sv-client'

/**
 * 输访问密码解锁一篇文章。story-verse 校验密码、按读者 IP 限流，签发只对这一篇有效的
 * token；token 只进 httpOnly cookie，不返回给浏览器脚本。错误（密码不对 403、
 * 尝试太多 429 …）的状态码和错误体原样还给页面。
 */
export default defineEventHandler(async (event) => {
  const id = requireIdParam(event)
  const body = await readBody<{ password?: unknown }>(event)
  const password = typeof body?.password === 'string' ? body.password : ''
  setResponseHeader(event, 'cache-control', 'private, no-store')

  const res = await $fetch.raw<SvPostUnlockResult>(`/api/posts/${id}/unlock`, {
    baseURL: useRuntimeConfig(event).apiEntry,
    method: 'POST',
    body: { password },
    headers: readerHeaders(event),
    ignoreResponseError: true,
  })
  if (!res.ok || !res._data) {
    setResponseStatus(event, res.status)
    const retryAfter = res.headers.get('retry-after')
    if (retryAfter) setResponseHeader(event, 'retry-after', Number(retryAfter))
    return res._data
  }
  const expiresAt = new Date(res._data.expiresAt)
  setUnlockCookie(event, id, res._data.token, expiresAt)
  return { ok: true, expiresAt: expiresAt.toISOString() }
})
