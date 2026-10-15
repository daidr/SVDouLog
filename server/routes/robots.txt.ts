import { trimTrailingSlash } from '../utils/xml'

/** 动态生成，sitemap 地址跟随 NUXT_PUBLIC_SITE_URL。 */
export default defineEventHandler((event) => {
  const siteUrl = trimTrailingSlash(useRuntimeConfig(event).public.siteUrl)
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
})
