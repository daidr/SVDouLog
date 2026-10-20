import type { IPostDetail } from '~~/types/feed'
import { Buffer } from 'node:buffer'
import { postShareCardContent, shareCardTheme, shareCardVersion } from '~~/shared/utils/share-card'
import { loadPalettes } from '../../../../utils/share-card/assets'
import { renderShareCard } from '../../../../utils/share-card/render'
import { SV_CACHE } from '../../../../utils/sv-cache'

/**
 * 渲染好的 PNG（base64）。键是文章 id + 内容版本：标题、摘要、站点名这些画在图上的东西
 * 一变，版本就变，旧键自然作废，所以只需要一个够长的过期时间回收空间。
 */
const renderCached = defineCachedFunction(
  async (_id: number, _version: string, content: Parameters<typeof renderShareCard>[0], palette: string[]) =>
    Buffer.from(await renderShareCard(content, palette)).toString('base64'),
  {
    name: SV_CACHE.shareCard,
    getKey: (id: number, version: string) => `${id}-${version}`,
    maxAge: 60 * 60 * 24 * 30,
  },
)

/**
 * 没有封面的文章的分享图：`/og/post/<id>/<version>.png`，版本号由页面按
 * shared/utils/share-card.ts 的规则算出。
 *
 * 地址里的版本和文章当前内容一致时，图片永不变，可以让浏览器和 CDN 永久缓存；不一致（旧
 * 链接、页面和这里看到的数据有时间差）时照样画当前内容，但只短时间缓存。
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const version = /^([a-z0-9]+)\.png$/.exec(getRouterParam(event, 'file') ?? '')?.[1]
  if (!/^[1-9]\d*$/.test(id) || !version) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  // 走文章详情的共享缓存；不带读者身份，设了密码的文章拿到的是锁定形态
  const post = await $fetch<IPostDetail>(`/api/post/${id}`).catch((e) => {
    throw createError({
      statusCode: (e as { statusCode?: number }).statusCode === 404 ? 404 : 502,
      statusMessage: 'post unavailable',
    })
  })
  const config = useRuntimeConfig(event)
  const metadata = await getSiteMetadata(config.apiEntry)
  const content = postShareCardContent(post, metadata)
  const current = shareCardVersion(post.id, content, config.public.shareCardRevision)
  const palettes = await loadPalettes()
  const palette = palettes[shareCardTheme(post.id, palettes.length)]!

  const png = Buffer.from(await renderCached(post.id, current, content, palette), 'base64')
  setResponseHeaders(event, {
    'content-type': 'image/png',
    'cache-control': version === current ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
  })
  return png
})
