import type { H3Event } from 'h3'

/**
 * 服务端代读者调用 story-verse 的统一出口（BFF）。
 *
 * 浏览器只和本站通信，story-verse 当作 headless CMS 藏在后面。凡是按「读者身份」
 * 生效的接口（评论、点赞、阅读量），core 都要知道读者是谁，所以这里负责把身份带过去：
 *   - IP：带 `x-sv-frontend-token`（= core 的 SV_FRONTEND_TOKEN）声明读者 IP，
 *     core 只在密钥正确时采信，网络位置不限（Serverless 出口 IP 不固定）
 *   - UA / Accept-Language：原样透传，core 用 IP+UA 做匿名身份指纹
 *   - 登录态：只透传 better-auth 的 session cookie，本站其它 cookie 不外发
 */

const FRONTEND_TOKEN_HEADER = 'x-sv-frontend-token'
const FRONTEND_CLIENT_IP_HEADER = 'x-sv-frontend-client-ip'

/** better-auth 默认 cookie 前缀；secure 环境下带 `__Secure-` */
const AUTH_COOKIE = /^(?:__Secure-)?better-auth\./

/**
 * 读者 IP：配置了 NUXT_CLIENT_IP_HEADER（本站前面的反代 / 平台写入的头，如
 * `x-real-ip`）就读它，列表取最右一项（离本站最近的那一跳写入的值）；否则用 socket 对端。
 * 不配置时绝不读转发头——那是读者可以随便伪造的。
 */
export function getReaderIp(event: H3Event): string | undefined {
  const { clientIpHeader } = useRuntimeConfig(event)
  if (clientIpHeader) {
    const raw = getRequestHeader(event, clientIpHeader)
    const last = raw?.split(',').map(s => s.trim()).filter(Boolean).at(-1)
    if (last) return last
  }
  return getRequestIP(event) ?? undefined
}

function authCookies(event: H3Event): string | undefined {
  const cookies = parseCookies(event)
  const pairs = Object.entries(cookies)
    .filter(([name]) => AUTH_COOKIE.test(name))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
  return pairs.length ? pairs.join('; ') : undefined
}

/** 代读者调用时附加的请求头。 */
export function readerHeaders(event: H3Event): Record<string, string> {
  const { svFrontendToken } = useRuntimeConfig(event)
  const headers: Record<string, string> = {}
  const ua = getRequestHeader(event, 'user-agent')
  if (ua) headers['user-agent'] = ua
  const lang = getRequestHeader(event, 'accept-language')
  if (lang) headers['accept-language'] = lang
  const cookie = authCookies(event)
  if (cookie) headers.cookie = cookie
  const ip = getReaderIp(event)
  if (svFrontendToken && ip) {
    headers[FRONTEND_TOKEN_HEADER] = svFrontendToken
    headers[FRONTEND_CLIENT_IP_HEADER] = ip
  }
  return headers
}

/**
 * 把一次读者请求转发到 story-verse 的 JSON 接口，并把状态码、限流头和错误体原样还给浏览器
 * （组件按 `err.data.message` 展示后端的错误描述）。
 */
export async function proxySvJson(
  event: H3Event,
  path: string,
  opts: { method?: 'GET' | 'POST', query?: Record<string, unknown>, body?: unknown } = {},
) {
  const { apiEntry } = useRuntimeConfig(event)
  const res = await $fetch.raw(path, {
    baseURL: apiEntry,
    method: opts.method ?? 'GET',
    query: opts.query,
    body: opts.body as Record<string, unknown> | undefined,
    headers: readerHeaders(event),
    ignoreResponseError: true,
  })
  setResponseStatus(event, res.status)
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter) setResponseHeader(event, 'retry-after', retryAfter)
  // 读者相关的结果因人而异，不能被任何共享缓存存下
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return res._data
}

/** 路由参数里的正整数 id；非法直接 400，不打到后端。 */
export function requireIdParam(event: H3Event, name = 'id'): number {
  const raw = getRouterParam(event, name) ?? ''
  if (!/^[1-9]\d*$/.test(raw)) {
    throw createError({ statusCode: 400, statusMessage: `${name} should be a positive integer` })
  }
  return Number(raw)
}
