import { readerHeaders } from '../../utils/sv-client'

/**
 * Better Auth 代理（`/api/auth/*` → story-verse 的 `/api/auth/*`）。
 *
 * 读者在本站登录：浏览器只和本站通信，session cookie 写在本站域名下，之后
 * 其它 BFF 接口经 readerHeaders 把它带回 story-verse。这里负责：
 *   - 只放行读者会用到的端点，后台 / admin 插件的端点一律 404
 *   - 透传 Origin / Referer / Sec-Fetch-*：story-verse 的 Better Auth 靠它们做
 *     CSRF 校验，本站的源要写进 story-verse 的 SV_CORS_ORIGINS
 *   - 跳转原样交给浏览器（验证邮箱、找回密码、GitHub 回调都是 302），
 *     Set-Cookie 去掉 Domain，只落在本站
 *   - 响应体里的 session token 删掉：cookie 是 httpOnly 的，没理由让脚本读到它
 *
 * 邮件里的验证 / 重置链接由 story-verse 改写到本站的 `/api/auth/...`
 * （要求后台「前端站点地址」填的是本站），所以 GET 端点也要经过这里。
 */

const ROUTES: Record<string, RegExp[]> = {
  GET: [
    /^verify-email$/,
    /^reset-password\/[\w-]+$/,
    /^callback\/github$/,
  ],
  POST: [
    /^sign-up\/email$/,
    /^sign-in\/email$/,
    /^sign-in\/social$/,
    /^sign-out$/,
    /^send-verification-email$/,
    /^request-password-reset$/,
    /^reset-password$/,
  ],
}

const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'origin',
  'referer',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
]

function isAllowed(method: string, path: string) {
  return ROUTES[method]?.some(re => re.test(path)) ?? false
}

/** Set-Cookie 去掉 Domain：cookie 只属于本站，不管后端怎么配。 */
function hostOnly(cookie: string) {
  return cookie.split(';').filter(part => !/^\s*domain\s*=/i.test(part)).join(';')
}

/**
 * 跳转目标：Better Auth 只会跳到 callbackURL（已按白名单校验，都是本站地址）。
 * 例外是它自带的错误页（GitHub 回调的 state 都解析不出来时），那一页指回 story-verse，
 * 换成本站登录页带上错误码，既不暴露后端地址，读者也能接着重试。
 */
function rewriteLocation(location: string, apiEntry: string) {
  try {
    const target = new URL(location, apiEntry)
    if (target.origin !== new URL(apiEntry).origin) return target.toString()
    const error = target.searchParams.get('error') || 'unknown'
    return `/blog/account/sign-in?error=${encodeURIComponent(error)}`
  } catch {
    return location
  }
}

function stripToken(body: string) {
  try {
    const data = JSON.parse(body)
    if (data && typeof data === 'object' && 'token' in data) {
      delete data.token
      return JSON.stringify(data)
    }
  } catch { /* 不是 JSON，原样返回 */ }
  return body
}

export default defineEventHandler(async (event) => {
  const method = event.method
  const path = getRouterParam(event, 'path') ?? ''
  if (!isAllowed(method, path)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { apiEntry } = useRuntimeConfig(event)
  const headers: Record<string, string> = readerHeaders(event)
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = getRequestHeader(event, name)
    if (value) headers[name] = value
  }

  const url = new URL(`/api/auth/${path}`, apiEntry)
  url.search = getRequestURL(event).search

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? await readRawBody(event, false) : undefined,
    redirect: 'manual',
  })

  setResponseStatus(event, res.status)
  // 登录态相关的响应因人而异，任何共享缓存都不能存
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const cookies = res.headers.getSetCookie().map(hostOnly)
  if (cookies.length) setResponseHeader(event, 'set-cookie', cookies)
  for (const name of ['content-type', 'retry-after', 'x-retry-after']) {
    const value = res.headers.get(name)
    if (value) setResponseHeader(event, name, value)
  }
  const location = res.headers.get('location')
  if (location) setResponseHeader(event, 'location', rewriteLocation(location, apiEntry))

  const body = await res.text()
  return res.headers.get('content-type')?.includes('application/json') ? stripToken(body) : body
})
