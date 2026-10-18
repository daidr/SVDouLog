import type { IPostDetail } from '~~/types/feed'
import { SV_CACHE, svCacheMaxAge } from '../../../utils/sv-cache'

const { apiEntry } = useRuntimeConfig()

/**
 * slug → 文章 id。只缓存这层映射，详情仍走按 id 缓存的 `/api/post/:id`，同一篇只存一份，
 * 失效也只按 id。文章事件会整组清掉映射（改名后旧 slug 不再指向它）；不存在的 slug 记成 null。
 */
const resolvePostId = defineCachedFunction(
  async (slug: string): Promise<number | null> => {
    try {
      const post = await $fetch<{ id: number }>(`/api/posts/by-slug/${encodeURIComponent(slug)}`, { baseURL: apiEntry })
      return post.id
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return null
      throw e
    }
  },
  {
    name: SV_CACHE.postSlug,
    getKey: (slug: string) => slug,
    swr: true,
    maxAge: svCacheMaxAge(60),
  },
)

/** 按 slug 取文章详情，给 `/blog/<slug>` 用 */
export default defineEventHandler(async (event): Promise<IPostDetail> => {
  const slug = getRouterParam(event, 'slug', { decode: true }) ?? ''
  let id: number | null
  try {
    id = await resolvePostId(slug)
  } catch (e) {
    console.error(e)
    throw createError({ statusCode: 502, statusMessage: 'upstream error' })
  }
  if (id === null) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }
  return event.$fetch<IPostDetail>(`/api/post/${id}`)
})
