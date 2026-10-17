import type { SvContentChangeEvent } from './sv'

/**
 * 回源 story-verse 的缓存 handler 统一在这里命名，webhook 才能按名字精准失效。
 *
 * Nitro 的 handler 缓存键是 `cache:nitro:handlers:<name>:<key>.json`，所以：
 *   - 显式 `name` 让同一类数据落在可枚举的前缀下
 *   - 文章详情再用 `getKey` 把 key 固定成文章 id，同一篇只占一个键
 */
export const SV_CACHE = {
  post: 'sv-post',
  flow: 'sv-flow',
  search: 'sv-search',
  seriesList: 'sv-series-list',
  series: 'sv-series',
  related: 'sv-related',
  friends: 'sv-friends',
  projects: 'sv-projects',
  feed: 'sv-feed',
  sitemap: 'sv-sitemap',
  taxonomy: 'sv-taxonomy',
  archive: 'sv-archive',
} as const

type SvCacheName = (typeof SV_CACHE)[keyof typeof SV_CACHE]

const HANDLER_PREFIX = 'cache:nitro:handlers'

/**
 * 配了 webhook 密钥就意味着 story-verse 会在内容变更时主动通知，缓存可以放心拉长；
 * 没配则退回短 TTL，靠过期兜底新鲜度。
 */
export function svCacheMaxAge(withoutWebhook: number, withWebhook = 3600) {
  return useRuntimeConfig().svWebhookSecret ? withWebhook : withoutWebhook
}

async function clearGroup(name: SvCacheName) {
  const storage = useStorage()
  const keys = await storage.getKeys(`${HANDLER_PREFIX}:${name}:`)
  await Promise.all(keys.map(key => storage.removeItem(key)))
  return keys.length
}

/**
 * 按变更的资源类型挑出受影响的缓存。宁可多清：漏清意味着读者在 TTL 内看到旧内容，
 * 多清只是多回源一次。
 */
export async function invalidateForChange(change: SvContentChangeEvent): Promise<number> {
  const tasks: Promise<number>[] = []
  switch (change.resource) {
    case 'post':
      // 文章详情要整组清：同系列其它文章的导航（第 n / N 篇、上一篇 / 下一篇的标题）
      // 也会因这一篇的发布、撤回、改名或换系列而变，单看事件找不全它们
      tasks.push(clearGroup(SV_CACHE.post))
      // 列表、相关文章、订阅源、sitemap、系列页都带着文章的标题 / 时间 / 可见性
      tasks.push(clearGroup(SV_CACHE.flow), clearGroup(SV_CACHE.search), clearGroup(SV_CACHE.related), clearGroup(SV_CACHE.feed), clearGroup(SV_CACHE.sitemap))
      tasks.push(clearGroup(SV_CACHE.seriesList), clearGroup(SV_CACHE.series))
      // 分类 / 标签的文章数和归档列表
      tasks.push(clearGroup(SV_CACHE.taxonomy), clearGroup(SV_CACHE.archive))
      break
    case 'category':
      // 分类名冗余在文章详情、列表、相关文章和订阅源里
      tasks.push(clearGroup(SV_CACHE.post), clearGroup(SV_CACHE.flow), clearGroup(SV_CACHE.search), clearGroup(SV_CACHE.related), clearGroup(SV_CACHE.feed))
      tasks.push(clearGroup(SV_CACHE.seriesList), clearGroup(SV_CACHE.series))
      // 分类索引、归档页标题和 sitemap 里的分类链接
      tasks.push(clearGroup(SV_CACHE.taxonomy), clearGroup(SV_CACHE.archive), clearGroup(SV_CACHE.sitemap))
      break
    case 'series':
      // 系列名、slug、成员和顺序都冗余在文章详情的系列导航里
      tasks.push(clearGroup(SV_CACHE.seriesList), clearGroup(SV_CACHE.series), clearGroup(SV_CACHE.post))
      break
    case 'friend-link':
      tasks.push(clearGroup(SV_CACHE.friends))
      break
    case 'project':
    case 'project-category':
      tasks.push(clearGroup(SV_CACHE.projects))
      break
    case 'site':
      // 站点标题、链接规则等影响面不好收窄，全部清掉
      tasks.push(...Object.values(SV_CACHE).map(clearGroup))
      break
  }
  const counts = await Promise.all(tasks)
  return counts.reduce((a, b) => a + b, 0)
}
