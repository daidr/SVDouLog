/**
 * story-verse 后端的字段类型与媒体 URL 助手。
 *
 * 后端公开接口（`/api/posts`、`/api/posts/:id`、`/api/ai-summary` 等）的形态在这里
 * 集中描述，避免每个 server route 各写一份零散的 any。字段集合按 PostService 的
 * select 形态对齐：列表项与详情比详情多了 `content`、`imageIds`、`relatedPostIds`，
 * 其余字段共享。
 */

export interface SvPostListItem {
  id: number
  title: string
  type: 'post' | 'note' | 'page'
  summary: string | null
  slug: string | null
  pin: boolean
  tags: string[] | null
  categoryId: number | null
  commentsCount: number
  likesCount: number
  viewsCount: number
  heroId: number | null
  mood: string | null
  weather: string | null
  allowComments: boolean
  authorId: number
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  categoryName: string | null
  categorySlug: string | null
  authorName: string | null
  heroEtag: string | null
  /** 封面图的 BlurHash 字符串（用于列表封面的渐进式模糊占位）；无封面时为 null */
  heroBlurHash: string | null
}

/**
 * 文章正文引用到的媒体清单条目。后端 `/api/posts/:id` 把正文里的
 * `![alt](@<id>)` 反解成 `/api/media/raw/<id>?webp=true`，并随响应带上这份清单，
 * 让前端在图片加载前就能用 width/height 固定盒子（aspect-ratio）、用 blurHash /
 * prominentColor 占位，消除布局抖动。
 */
export interface SvPostMediaItem {
  id: number
  width: number | null
  height: number | null
  blurHash: string | null
  prominentColor: string | null
  mimeType: string
}

export interface SvPostDetail extends SvPostListItem {
  content: string
  imageIds: number[] | null
  relatedPostIds: number[] | null
  /** 正文引用到的媒体清单（尺寸 / blurHash / 主题色），按引用集合各一条 */
  media: SvPostMediaItem[]
}

/** 命中区间 `[start, end)`，按 JS 字符串下标 */
export type SvHighlightRange = [number, number]

/** `/api/posts/search` 的结果项：只带列表展示要的字段，正文换成带命中区间的纯文本片段 */
export interface SvSearchItem {
  id: number
  title: string
  type: 'post' | 'note' | 'page'
  slug: string | null
  summary: string | null
  tags: string[] | null
  publishedAt: string | null
  categoryName: string | null
  categorySlug: string | null
  titleHighlights: SvHighlightRange[]
  snippet: { text: string, highlights: SvHighlightRange[] }
}

export interface SvSearchResponse {
  list: SvSearchItem[]
  total: number
  hasNext: boolean
}

export interface SvPostListResponse {
  list: SvPostListItem[]
  total: number
  hasNext: boolean
  nextCursor?: number
}

export interface SvAiSummaryResponse {
  refType: 'post' | 'note' | 'page'
  refId: number
  lang: string
  content: string
  createdAt: string
}

/**
 * 公开端点 `/api/friend-links` 的形态——已在 story-verse 侧把 email 替换为
 * sha256 hash，原文邮箱不下发；列表一次性返回全量（无分页包裹）。
 */
export interface SvFriendLink {
  id: number
  name: string
  description: string | null
  url: string
  emailHash: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 公开端点 `/api/projects` 的形态——一次性全量数组（按 id 倒序）。
 *
 * 字段含义对齐 story-verse `ProjectService.listAllPublic` 的 select：
 *   - `categoryTitle`：从 project_categories 表 left-join 出的分类名；项目
 *     未分配分类（projectCategoryId=null）或分类已被删除（cascade set null）
 *     时为 null
 *   - `imageEtag`：封面图的 etag，用于拼 `?v=` 缓存破坏参数；imageId 为
 *     null（未设置封面）时本字段同样为 null
 */
export interface SvProject {
  id: number
  title: string
  description: string | null
  projectCategoryId: number | null
  imageId: number | null
  repoLink: string | null
  homepageLink: string | null
  createdAt: string
  updatedAt: string
  categoryTitle: string | null
  imageEtag: string | null
}

/**
 * 公开端点 `/api/project-categories` 的形态——一次性全量数组（按 id 升序）。
 */
export interface SvProjectCategory {
  id: number
  title: string
  description: string | null
  slug: string
  createdAt: string
  updatedAt: string
}

/**
 * 由媒体 id 拼出站内访问路径。
 *
 * 本站 `/api/media/raw/:id` 把请求代理到 story-verse 的同名接口（浏览器不直连后端），可附加 `?webp=true` 取衍生品 / `?thumbnail=true`
 * 取 192 方图。`heroEtag` 不参与路径但作为缓存破坏参数挂在 query 上——后端的
 * `Cache-Control: immutable` 是按 etag 命名的文件给出的，etag 变化时同 id 的 URL
 * 不变会被 CDN / 浏览器误命中旧缓存，加 `?v=` 把这种情况显式打掉。
 */
export function buildMediaUrl(
  id: number,
  opts: { webp?: boolean, thumbnail?: boolean, etag?: string | null } = {},
): string {
  const params = new URLSearchParams()
  if (opts.webp) params.set('webp', 'true')
  if (opts.thumbnail) params.set('thumbnail', 'true')
  if (opts.etag) params.set('v', opts.etag)
  const qs = params.toString()
  return `/api/media/raw/${id}${qs ? `?${qs}` : ''}`
}

/**
 * 内容变更 webhook 载荷 —— 与 story-verse `modules/webhook/contract.ts` 的
 * `ContentChangeEvent` 一致（也从 `@story-verse/api` 导出）。签名放在
 * `x-sv-signature` 头：`t=<unix 秒>,v1=hex(HMAC-SHA256(secret, "<t>.<rawBody>"))`。
 */
export type SvContentResource = 'post' | 'category' | 'friend-link' | 'project' | 'project-category' | 'site'

export interface SvContentChangeEvent {
  event: 'content.changed'
  resource: SvContentResource
  action: 'created' | 'updated' | 'deleted'
  id?: number
  type?: 'post' | 'note' | 'page'
  slug?: string | null
  at: string
}

/** `/api/feed/entries` 的条目：最近发布的 post / note，带 markdown 正文。 */
export interface SvFeedEntry {
  id: number
  type: 'post' | 'note'
  title: string
  summary: string | null
  content: string
  slug: string | null
  tags: string[] | null
  categoryName: string | null
  categorySlug: string | null
  authorName: string | null
  heroId: number | null
  heroEtag: string | null
  publishedAt: string | null
  updatedAt: string
}

/** `/api/feed/sitemap` 的一页：按 id 升序，nextCursor 缺省即最后一页。 */
export interface SvSitemapPage {
  list: Array<{ id: number, type: 'post' | 'note' | 'page', slug: string | null, publishedAt: string | null, updatedAt: string }>
  nextCursor?: number
}
