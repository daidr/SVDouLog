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
  /** 所在系列的导航；不在系列里为 null */
  series: SvPostSeriesNav | null
}

/** 系列导航里的上一篇 / 下一篇 */
export interface SvSeriesNavPost {
  id: number
  title: string
  slug: string | null
  type: 'post' | 'note' | 'page'
}

/**
 * 文章详情里的系列导航，对齐 story-verse `SeriesService.navFor`。
 * index 从 1 起，index / total 只按公开文章计。
 */
export interface SvPostSeriesNav {
  id: number
  name: string
  slug: string
  index: number
  total: number
  prev: SvSeriesNavPost | null
  next: SvSeriesNavPost | null
}

/** `/api/series` 的条目：有公开文章的系列，按最近一篇的发布时间倒序 */
export interface SvSeriesListItem {
  id: number
  name: string
  slug: string
  description: string | null
  postCount: number
  lastPublishedAt: string | null
}

/** `/api/series/by-slug/:slug`：系列信息和它的公开文章，按系列顺序 */
export interface SvSeriesDetail {
  id: number
  name: string
  slug: string
  description: string | null
  posts: Array<{
    id: number
    title: string
    type: 'post' | 'note' | 'page'
    slug: string | null
    summary: string | null
    heroId: number | null
    heroEtag: string | null
    heroBlurHash: string | null
    publishedAt: string | null
    commentsCount: number
    likesCount: number
  }>
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

/** `/api/posts/:id/related` 的结果项：手动指定的在前，其余按共享标签 / 分类补齐 */
export interface SvRelatedItem {
  id: number
  title: string
  type: 'post' | 'note' | 'page'
  slug: string | null
  summary: string | null
  publishedAt: string | null
  categoryName: string | null
  categorySlug: string | null
  heroId: number | null
  heroEtag: string | null
  heroBlurHash: string | null
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

/** `/api/categories` 的条目（只有启用的分类）；postCount 只数公开的 post / note */
export interface SvCategory {
  id: number
  name: string
  description: string | null
  slug: string
  sort: number | null
  postCount: number
}

/** `/api/tags` 的条目：公开 post / note 上的标签和带它的文章数 */
export interface SvTagCount {
  name: string
  count: number
}

/** story-verse 分页列表的通用外壳 */
export interface SvPage<T> {
  list: T[]
  total: number
  hasNext: boolean
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
  opts: { webp?: boolean, thumbnail?: boolean, width?: number, etag?: string | null } = {},
): string {
  const params = new URLSearchParams()
  if (opts.webp) params.set('webp', 'true')
  if (opts.webp && opts.width) params.set('w', String(opts.width))
  if (opts.thumbnail) params.set('thumbnail', 'true')
  if (opts.etag) params.set('v', opts.etag)
  const qs = params.toString()
  return `/api/media/raw/${id}${qs ? `?${qs}` : ''}`
}

/**
 * story-verse 为图片生成的 webp 宽度档位（core `utils/image.ts` 的 `RESPONSIVE_WIDTHS`）。
 * 两边不一致也不会出错：core 对 `?w=` 回不窄于它的最小一档，只是档位利用得没那么准。
 */
export const SV_RESPONSIVE_WIDTHS = [480, 960, 1440, 1920] as const

/**
 * 图片的 srcset：各档缩小的 webp，再加原宽的完整 webp。知道原图宽度（正文图有媒体清单）
 * 时只列比它窄的档；不知道（封面）就列全部档，比原图宽的档 core 会回完整 webp。
 */
export function buildMediaSrcset(id: number, opts: { width?: number | null, etag?: string | null } = {}): string {
  const { width, etag } = opts
  const widths = width ? SV_RESPONSIVE_WIDTHS.filter(w => w < width) : SV_RESPONSIVE_WIDTHS
  const entries = widths.map(w => `${buildMediaUrl(id, { webp: true, width: w, etag })} ${w}w`)
  if (width) entries.push(`${buildMediaUrl(id, { webp: true, etag })} ${width}w`)
  return entries.join(', ')
}

/**
 * 内容变更 webhook 载荷 —— 与 story-verse `modules/webhook/contract.ts` 的
 * `ContentChangeEvent` 一致（也从 `@story-verse/api` 导出）。签名放在
 * `x-sv-signature` 头：`t=<unix 秒>,v1=hex(HMAC-SHA256(secret, "<t>.<rawBody>"))`。
 */
export type SvContentResource = 'post' | 'category' | 'series' | 'friend-link' | 'project' | 'project-category' | 'site'

export interface SvContentChangeEvent {
  event: 'content.changed'
  resource: SvContentResource
  action: 'created' | 'updated' | 'deleted'
  id?: number
  type?: 'post' | 'note' | 'page'
  slug?: string | null
  /**
   * resource = 'post' / 'series' 时：公开详情也随之改变的其他文章（同系列文章的系列导航）。
   * 缺省表示 story-verse 没提供（旧版本），按整组失效处理。
   */
  affectedPostIds?: number[]
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
