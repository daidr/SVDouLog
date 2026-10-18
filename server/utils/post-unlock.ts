import type { H3Event } from 'h3'

/**
 * 设了访问密码的文章：读者输对密码后 story-verse 签发一枚只对这一篇有效的短期 token，
 * 本站把它放进按文章区分的 httpOnly cookie，浏览器脚本拿不到；之后读这篇的正文和评论时
 * 由服务端从 cookie 取出，放在 `x-sv-post-unlock` 请求头里转给 story-verse。
 *
 * 解锁后的内容因人而异，绝不能进共享缓存（Nitro handler 缓存、CDN、Service Worker）。
 */

export const UNLOCK_TOKEN_HEADER = 'x-sv-post-unlock'

const TOKEN_PATTERN = /^v1\.\d{1,10}\.\d{1,12}\.[\w-]{43}$/

function cookieName(postId: number) {
  return `sv_post_unlock_${postId}`
}

export function getUnlockToken(event: H3Event, postId: number): string | null {
  const value = getCookie(event, cookieName(postId))
  return value && TOKEN_PATTERN.test(value) ? value : null
}

export function setUnlockCookie(event: H3Event, postId: number, token: string, expiresAt: Date) {
  setCookie(event, cookieName(postId), token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearUnlockCookie(event: H3Event, postId: number) {
  deleteCookie(event, cookieName(postId), { path: '/' })
}

/** 带上这篇的解锁 token（有的话），供转发给 story-verse 的请求合并 */
export function unlockHeaders(event: H3Event, postId: number): Record<string, string> {
  const token = getUnlockToken(event, postId)
  return token ? { [UNLOCK_TOKEN_HEADER]: token } : {}
}
