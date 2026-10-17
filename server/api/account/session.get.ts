import type { IReaderAccount } from '~~/types/account'
import { createHash } from 'node:crypto'
import { readerHeaders } from '../../utils/sv-client'

interface SvSession {
  user: {
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
  }
}

/**
 * 当前读者的登录态。只回页面要用的几个字段：Better Auth 的 get-session 还带着
 * session token、IP 等，不下发到浏览器（所以 /api/auth 代理也不放行 get-session）。
 */
export default defineEventHandler(async (event): Promise<IReaderAccount | null> => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const headers = readerHeaders(event)
  if (!headers.cookie) return null

  const { apiEntry } = useRuntimeConfig(event)
  const session = await $fetch<SvSession | null>('/api/auth/get-session', {
    baseURL: apiEntry,
    headers,
  })
  if (!session?.user) return null

  const { name, email, emailVerified, image } = session.user
  return {
    name,
    email,
    emailVerified,
    image: image ?? null,
    // 和评论作者的 emailHash 同算法，头像统一走 gravatar 镜像
    emailHash: createHash('sha256').update(email.trim().toLowerCase()).digest('hex'),
  }
})
