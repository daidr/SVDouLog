import type { SvFeedEntry } from '../utils/sv'
import { renderMarkdown } from '../utils/markdown'
import { getSiteMetadata } from '../utils/metadata'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'
import { cdata, escapeXml, trimTrailingSlash } from '../utils/xml'

const FEED_SIZE = 20

/**
 * RSS 2.0 订阅源：最近 20 篇 post / note，全文输出。
 *
 * 数据来自 story-verse `/api/feed/entries`（已过滤 draft / private）；链接规则
 * （`/blog/<id>`）与 markdown 渲染都沿用站内同一套，订阅里看到的和页面一致。
 */
export default cachedEventHandler(
  async (event) => {
    const config = useRuntimeConfig(event)
    const siteUrl = trimTrailingSlash(config.public.siteUrl)
    const [{ list }, metadata] = await Promise.all([
      $fetch<{ list: SvFeedEntry[] }>('/api/feed/entries', {
        baseURL: config.apiEntry,
        query: { limit: FEED_SIZE },
      }),
      getSiteMetadata(config.apiEntry),
    ])

    const title = metadata?.site.title || metadata?.profile.name || siteUrl
    const description = metadata?.site.description || ''
    const selfUrl = `${siteUrl}/feed.xml`

    const items = list.map((entry) => {
      const link = `${siteUrl}/blog/${entry.id}`
      // 订阅阅读器在站外，媒体地址要补成本站的绝对地址（经本站媒体代理）。
      // 设了访问密码的没有正文，只放摘要
      const html = entry.content === null ? '' : renderMarkdown(entry.content, { assetBase: siteUrl })
      const categories = [entry.categoryName, ...(entry.tags ?? [])]
        .filter((c): c is string => !!c)
        .map(c => `<category>${escapeXml(c)}</category>`)
        .join('')
      return [
        '<item>',
        `<title>${escapeXml(entry.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        entry.publishedAt ? `<pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate>` : '',
        entry.authorName ? `<dc:creator>${cdata(entry.authorName)}</dc:creator>` : '',
        categories,
        entry.summary ? `<description>${cdata(entry.summary)}</description>` : '',
        html ? `<content:encoded>${cdata(html)}</content:encoded>` : '',
        '</item>',
      ].join('')
    })

    const lastBuild = list[0]?.publishedAt ? new Date(list[0].publishedAt) : new Date()

    setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
      '<channel>',
      `<title>${escapeXml(title)}</title>`,
      `<link>${escapeXml(siteUrl)}</link>`,
      `<atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>`,
      `<description>${escapeXml(description)}</description>`,
      `<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('\n')
  },
  {
    name: SV_CACHE.feed,
    swr: true,
    maxAge: svCacheMaxAge(600),
  },
)
