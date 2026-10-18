import type { ISharedPost } from '~~/types/feed'
import type { SvPostDetail } from '../../utils/sv'
import { toPostDetail } from '../../utils/post-detail'

type SvSharedPost
  = | { published: true, id: number }
    | { published: false, expiresAt: string, post: SvPostDetail }

/**
 * 草稿分享页的数据 —— 调 story-verse `/api/post-shares/:token`。
 *
 * 和正式文章的区别全在「不能被存下」：内容没公开、只认这条 token，所以不走
 * defineCachedEventHandler，响应头禁止任何共享缓存（CDN / 平台缓存 / Service Worker），
 * 也声明不进索引。token 无效 / 过期 / 撤销统一 404。
 */
export default defineEventHandler(async (event): Promise<ISharedPost> => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')

  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[\w-]{43}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  const { apiEntry } = useRuntimeConfig(event)
  const result = await $fetch<SvSharedPost>(`/api/post-shares/${token}`, { baseURL: apiEntry })
    .catch((e) => {
      if (e?.response?.status === 404) {
        throw createError({ statusCode: 404, statusMessage: 'not found' })
      }
      throw e
    })

  if (result.published) {
    // 只有 id：文章页会再跳到带 slug 的正式地址
    return { published: true, path: `/blog/${result.id}` }
  }
  return { published: false, expiresAt: result.expiresAt, post: toPostDetail(result.post) }
})
