import type { SvContentChangeEvent } from './sv'

/**
 * 回源 story-verse 的缓存 handler 统一在这里命名，webhook 才能按名字精准失效。
 *
 * Nitro 的 handler 缓存键是 `cache:nitro:handlers:<name>:<key>.json`，所以：
 *   - 显式 `name` 让同一类数据落在可枚举的前缀下
 *   - 文章详情再用 `getKey` 把 key 固定成文章 id，单篇失效不必扫描
 */
export const SV_CACHE = {
  post: 'sv-post',
  flow: 'sv-flow',
  search: 'sv-search',
  friends: 'sv-friends',
  projects: 'sv-projects',
  feed: 'sv-feed',
  sitemap: 'sv-sitemap',
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

async function clearPost(id: number) {
  await useStorage().removeItem(`${HANDLER_PREFIX}:${SV_CACHE.post}:${id}.json`)
  return 1
}

/**
 * 按变更的资源类型挑出受影响的缓存。宁可多清：漏清意味着读者在 TTL 内看到旧内容，
 * 多清只是多回源一次。
 */
export async function invalidateForChange(change: SvContentChangeEvent): Promise<number> {
  const tasks: Promise<number>[] = []
  switch (change.resource) {
    case 'post':
      // 列表、订阅源、sitemap 都带着文章的标题 / 时间 / 可见性
      tasks.push(change.id ? clearPost(change.id) : clearGroup(SV_CACHE.post))
      tasks.push(clearGroup(SV_CACHE.flow), clearGroup(SV_CACHE.search), clearGroup(SV_CACHE.feed), clearGroup(SV_CACHE.sitemap))
      break
    case 'category':
      // 分类名冗余在文章详情、列表和订阅源里
      tasks.push(clearGroup(SV_CACHE.post), clearGroup(SV_CACHE.flow), clearGroup(SV_CACHE.search), clearGroup(SV_CACHE.feed))
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
