import type { SvContentChangeEvent } from './sv'

/**
 * 回源 story-verse 的缓存 handler 统一在这里命名，webhook 才能按名字精准失效。
 *
 * Nitro 的 handler 缓存键是 `cache:nitro:handlers:<name>:<key>.json`，所以：
 *   - 显式 `name` 让同一类数据落在可枚举的前缀下
 *   - 文章详情再用 `getKey` 把 key 固定成文章 id，同一篇只占一个键，失效时按 id 直接删
 */
export const SV_CACHE = {
  post: 'sv-post',
  /** slug → 文章 id 的映射（cached function，见 server/api/post/by-slug） */
  postSlug: 'sv-post-slug',
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
  /** 文章分享图（cached function，键里带内容散列，内容变了键就变，不用失效） */
  shareCard: 'sv-share-card',
} as const

type SvCacheName = (typeof SV_CACHE)[keyof typeof SV_CACHE]

const HANDLER_PREFIX = 'cache:nitro:handlers'
const FUNCTION_PREFIX = 'cache:nitro:functions'

/**
 * 配了 webhook 密钥就意味着 story-verse 会在内容变更时主动通知，缓存可以放心拉长；
 * 没配则退回短 TTL，靠过期兜底新鲜度。
 */
export function svCacheMaxAge(withoutWebhook: number, withWebhook = 3600) {
  return useRuntimeConfig().svWebhookSecret ? withWebhook : withoutWebhook
}

async function clearGroup(name: SvCacheName) {
  const storage = useStorage()
  // slug 映射是 cached function，其余都是 cached handler，两者的键前缀不同
  const prefix = name === SV_CACHE.postSlug ? FUNCTION_PREFIX : HANDLER_PREFIX
  const keys = await storage.getKeys(`${prefix}:${name}:`)
  await Promise.all(keys.map(key => storage.removeItem(key)))
  return keys.length
}

/** 删掉文章详情缓存里这些 id 的键（键名见 server/api/post/[id].ts 的 getKey） */
async function clearPosts(ids: number[]) {
  const storage = useStorage()
  const keys = [...new Set(ids)].map(id => `${HANDLER_PREFIX}:${SV_CACHE.post}:${id}.json`)
  const present = await Promise.all(keys.map(key => storage.hasItem(key)))
  await Promise.all(keys.map(key => storage.removeItem(key)))
  return present.filter(Boolean).length
}

/**
 * 文章详情：story-verse 给了 affectedPostIds（同系列文章，系列导航会变）就只清这些，外加
 * post 事件本身那篇；没给（旧版本）就整组清，单看事件找不全同系列的文章。
 */
function clearPostDetails(change: SvContentChangeEvent) {
  if (!change.affectedPostIds) {
    return clearGroup(SV_CACHE.post)
  }
  const own = change.resource === 'post' && change.id !== undefined ? [change.id] : []
  return clearPosts([...own, ...change.affectedPostIds])
}

/**
 * 按变更的资源类型挑出受影响的缓存。宁可多清：漏清意味着读者在 TTL 内看到旧内容，
 * 多清只是多回源一次。
 */
export async function invalidateForChange(change: SvContentChangeEvent): Promise<number> {
  const tasks: Promise<number>[] = []
  switch (change.resource) {
    case 'post':
      // 这一篇的发布、撤回、改名或换系列也会改同系列其它文章的导航（第 n / N 篇、上下篇标题）
      tasks.push(clearPostDetails(change))
      // slug 可能改了：旧 slug 不该再指向这篇，新 slug 之前可能记成了不存在
      tasks.push(clearGroup(SV_CACHE.postSlug))
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
      tasks.push(clearGroup(SV_CACHE.seriesList), clearGroup(SV_CACHE.series), clearGroup(SV_CACHE.sitemap), clearPostDetails(change))
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
      tasks.push(...Object.values(SV_CACHE).map(name => clearGroup(name)))
      break
  }
  const counts = await Promise.all(tasks)
  return counts.reduce((a, b) => a + b, 0)
}
