import type { MaybeRefOrGetter } from 'vue'
import { useI18n as useVueI18n } from 'vue-i18n'

/** 没有封面的页面分享卡片用头像 */
const DEFAULT_SHARE_IMAGE = '/images/avatar.png'

/** 不该被收录的路由：404、离线兜底页、草稿预览 */
const NON_CANONICAL_ROUTES = new Set(['slug', 'offline', 'preview'])

/** 首页是 /me 的别名，两个地址都指向 / */
const CANONICAL_PATHS: Record<string, string> = { 'index-me': '/' }

/**
 * head 用的翻译函数。项目里的 useI18n 在注水前返回空串（避免正文注水不一致），
 * 但 head 不参与注水，服务端就得输出真实文字给爬虫和分享卡片。
 */
export function useHeadT() {
  return useVueI18n().t
}

/** 站内路径 → 带站点域名的绝对地址 */
export function useAbsoluteUrl() {
  const siteUrl = useRuntimeConfig().public.siteUrl.replace(/\/+$/, '')
  return (path: string) => new URL(path, `${siteUrl}/`).href
}

export function useSiteName() {
  const metadata = useSiteMetadata()
  const t = useHeadT()
  return computed(() => metadata.value?.site?.title || t('global.site_name'))
}

/** 博主名，JSON-LD 的 author 用 */
export function useAuthorName() {
  const metadata = useSiteMetadata()
  const t = useHeadT()
  return computed(() => metadata.value?.profile?.name || t('global.name'))
}

/**
 * 全站默认的 head：canonical、og:url 跟着当前路由走（不带 query、去掉末尾斜杠），
 * 其余 og / twitter 字段给出站点级兜底，页面用 usePageSeo 覆盖。只在 app.vue 调一次。
 */
export function useSiteSeoDefaults() {
  const route = useRoute()
  const toAbs = useAbsoluteUrl()
  const siteName = useSiteName()
  const metadata = useSiteMetadata()
  const t = useHeadT()

  const error = useError()

  const canonical = computed(() => {
    // 出错页（404 等）显示在出错的地址上，这个地址不该被收录
    if (error.value) return null
    const name = String(route.name)
    if (NON_CANONICAL_ROUTES.has(name)) return null
    const path = CANONICAL_PATHS[name] ?? (route.path.length > 1 ? route.path.replace(/\/+$/, '') : '/')
    return toAbs(path)
  })
  const description = computed(() => metadata.value?.site?.description || t('global.desc'))

  useHead({
    link: computed(() => canonical.value ? [{ key: 'canonical', rel: 'canonical', href: canonical.value }] : []),
  })
  useSeoMeta({
    description,
    ogSiteName: siteName,
    ogType: 'website',
    ogTitle: siteName,
    ogDescription: description,
    ogUrl: () => canonical.value ?? undefined,
    ogImage: toAbs(DEFAULT_SHARE_IMAGE),
    twitterCard: 'summary',
  })
}

export interface PageSeoInput {
  /** 页面标题，不带站点名 */
  title: MaybeRefOrGetter<string | null | undefined>
  /** 留空用站点描述 */
  description?: MaybeRefOrGetter<string | null | undefined>
  /** 分享卡片大图，站内路径或绝对地址；留空用默认头像小卡片 */
  image?: MaybeRefOrGetter<string | null | undefined>
  /** 大图的像素尺寸，知道就给，平台不用先下载图片就能排版 */
  imageWidth?: MaybeRefOrGetter<number | null | undefined>
  imageHeight?: MaybeRefOrGetter<number | null | undefined>
  imageAlt?: MaybeRefOrGetter<string | null | undefined>
  type?: 'website' | 'article'
}

/** 页面级 title / description / Open Graph，覆盖 useSiteSeoDefaults 的兜底值 */
export function usePageSeo(input: PageSeoInput) {
  const toAbs = useAbsoluteUrl()
  const title = () => toValue(input.title) || undefined
  const description = () => toValue(input.description) || undefined
  const image = () => {
    const src = toValue(input.image)
    return src ? toAbs(src) : undefined
  }

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: input.type,
    ogImage: image,
    twitterImage: image,
    ogImageWidth: () => image() ? toValue(input.imageWidth) || undefined : undefined,
    ogImageHeight: () => image() ? toValue(input.imageHeight) || undefined : undefined,
    ogImageAlt: () => image() ? toValue(input.imageAlt) || undefined : undefined,
    twitterImageAlt: () => image() ? toValue(input.imageAlt) || undefined : undefined,
    twitterCard: () => image() ? 'summary_large_image' : undefined,
  })
}
