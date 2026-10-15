import { requireIdParam } from '../../../utils/sv-client'

/** 只透传这些 query：取衍生品的开关和缓存破坏参数，其它一律丢弃。 */
const FORWARDED_QUERY = ['webp', 'thumbnail', 'v'] as const

const FORWARDED_REQUEST_HEADERS = ['accept', 'if-none-match', 'if-modified-since', 'range'] as const
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
  'location',
] as const

/**
 * 媒体文件代理：`/api/media/raw/:id` 与 story-verse 同路径，正文和封面里的图片
 * 地址因此都是站内相对路径，浏览器不直接访问后端。
 *
 * 流式转发、不落盘；条件请求 / Range 透传，缓存交给后端给出的 Cache-Control
 * （按 etag 命名的文件是 immutable，可直接被 CDN 缓存）。存储后端配了公开域名时
 * story-verse 回 302，这里原样转给浏览器。
 */
export default defineEventHandler(async (event) => {
  const id = requireIdParam(event)
  const { apiEntry } = useRuntimeConfig(event)

  const query = getQuery(event)
  const params = new URLSearchParams()
  for (const key of FORWARDED_QUERY) {
    const value = query[key]
    if (typeof value === 'string' && value) params.set(key, value)
  }
  const qs = params.toString()
  const url = `${apiEntry.replace(/\/+$/, '')}/api/media/raw/${id}${qs ? `?${qs}` : ''}`

  const headers: Record<string, string> = {}
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = getRequestHeader(event, name)
    if (value) headers[name] = value
  }

  // 配了 CDN 的存储后端会 302 到公开地址：原样把跳转交给浏览器，让它直接走 CDN，
  // 不在这里替 CDN 搬字节
  const upstream = await fetch(url, { headers, redirect: 'manual' })
  setResponseStatus(event, upstream.status)
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) setResponseHeader(event, name, value)
  }
  if (!upstream.body || upstream.status === 304 || (upstream.status >= 300 && upstream.status < 400)) {
    return null
  }
  return sendStream(event, upstream.body)
})
