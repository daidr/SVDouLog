import type { SvSeriesListItem, SvSitemapPage } from '../utils/sv'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'
import { loadTaxonomy } from '../utils/sv-taxonomy'
import { escapeXml, trimTrailingSlash } from '../utils/xml'

/** 站内固定页面（不来自 story-verse 内容表）。 */
const STATIC_PATHS = ['/', '/blog', '/blog/series', '/blog/topics', '/projects', '/friends', '/me']

/** 单个 sitemap 文件的协议上限。 */
const SITEMAP_URL_LIMIT = 50_000

/**
 * sitemap.xml：固定页面 + 有公开文章的系列、分类 / 标签归档页 + 全部公开 post / note（`/blog/<id>`）。
 *
 * story-verse 的 `page` 亚型在 douLog 里还没有对应路由，收进来只会给爬虫一串 404，
 * 所以先跳过；等站点支持独立页面后在这里补上它的链接规则即可。
 */
export default cachedEventHandler(
  async (event) => {
    const config = useRuntimeConfig(event)
    const siteUrl = trimTrailingSlash(config.public.siteUrl)

    const entries: string[] = STATIC_PATHS.map(path => `<url><loc>${escapeXml(`${siteUrl}${path === '/' ? '/' : path}`)}</loc></url>`)

    const [taxonomy, series] = await Promise.all([
      loadTaxonomy(config.apiEntry),
      $fetch<SvSeriesListItem[]>('/api/series', { baseURL: config.apiEntry }),
    ])
    for (const item of series) {
      entries.push(`<url><loc>${escapeXml(`${siteUrl}/blog/series/${encodeURIComponent(item.slug)}`)}</loc></url>`)
    }
    for (const category of taxonomy.categories) {
      entries.push(`<url><loc>${escapeXml(`${siteUrl}/blog/category/${encodeURIComponent(category.slug)}`)}</loc></url>`)
    }
    for (const tag of taxonomy.tags) {
      entries.push(`<url><loc>${escapeXml(`${siteUrl}/blog/tag/${encodeURIComponent(tag.name)}`)}</loc></url>`)
    }

    let cursor: number | undefined
    do {
      const page: SvSitemapPage = await $fetch<SvSitemapPage>('/api/feed/sitemap', {
        baseURL: config.apiEntry,
        query: { size: 5000, ...(cursor ? { cursor } : {}) },
      })
      for (const item of page.list) {
        if (item.type === 'page') continue
        const lastmod = new Date(item.updatedAt).toISOString()
        entries.push(`<url><loc>${escapeXml(`${siteUrl}${postPath(item)}`)}</loc><lastmod>${lastmod}</lastmod></url>`)
      }
      cursor = page.nextCursor
    } while (cursor && entries.length < SITEMAP_URL_LIMIT)

    if (cursor || entries.length > SITEMAP_URL_LIMIT) {
      console.warn(`[sitemap] more than ${SITEMAP_URL_LIMIT} URLs; truncating (split into a sitemap index when this happens)`)
    }

    setHeader(event, 'content-type', 'application/xml; charset=utf-8')
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries.slice(0, SITEMAP_URL_LIMIT),
      '</urlset>',
    ].join('\n')
  },
  {
    name: SV_CACHE.sitemap,
    swr: true,
    maxAge: svCacheMaxAge(3600, 86_400),
  },
)
