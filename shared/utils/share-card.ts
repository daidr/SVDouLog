import type { SiteMetadata } from '../../types/metadata'
import en from '../../i18n/locales/en.json'

/**
 * 没有封面的文章自动生成的分享图（og:image）。页面和 server/routes/og 共用这里的规则：
 * 页面据此给出图片地址，服务端据此决定画什么，两边算出的版本号一致。
 */

export const SHARE_CARD_WIDTH = 1200
export const SHARE_CARD_HEIGHT = 630

/** 分享图上画的全部文字 */
export interface ShareCardContent {
  title: string
  /** 设了访问密码的文章只露标题，这里为 null */
  summary: string | null
  siteName: string
  authorName: string
  authorHandle: string
}

export interface ShareCardPost {
  id: number
  title: string
  summary: string
  passwordProtected: boolean
}

/**
 * 分享图的文字。站点名、博主名缺省时用默认语言（en）的文案：图片按 URL 缓存，
 * 不能随访问者的语言变。
 */
export function postShareCardContent(post: ShareCardPost, metadata: SiteMetadata | null | undefined): ShareCardContent {
  const siteName = metadata?.site?.title || en.global.site_name
  return {
    title: post.title.trim() || siteName,
    summary: post.passwordProtected ? null : post.summary.trim() || null,
    siteName,
    authorName: metadata?.profile?.name || en.global.name,
    authorHandle: metadata?.profile?.handle || en.global.en_name,
  }
}

/** 文章用哪套主题色（站点随机挑主题色，分享图按 id 固定一套） */
export function shareCardTheme(postId: number, themeCount: number) {
  return postId % themeCount
}

/** cyrb53：53 位字符串散列，两端（浏览器 / 服务端）同步可算 */
function hash53(text: string) {
  let h1 = 0xDEADBEEF
  let h2 = 0x41C6CE57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * 图片版本：画面内容 + 构建时的版式散列（`runtimeConfig.public.shareCardRevision`）。
 * 内容或版式一变地址就变，所以同一个地址的图可以被永久缓存。
 */
export function shareCardVersion(postId: number, content: ShareCardContent, revision: string) {
  return hash53(JSON.stringify([revision, postId, content]))
}

export function postShareCardPath(postId: number, content: ShareCardContent, revision: string) {
  return `/og/post/${postId}/${shareCardVersion(postId, content, revision)}.png`
}

/** emoji 按 key 的散列分到这么多个文件，渲染时只读用得上的那几份（构建时分桶，见 modules/share-card.ts） */
export const SHARE_CARD_EMOJI_BUCKETS = 32

/** emoji key（如 `1f468-200d-1f4bb`）→ 分桶序号 */
export function shareCardEmojiBucket(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) >>> 0
  return hash % SHARE_CARD_EMOJI_BUCKETS
}
