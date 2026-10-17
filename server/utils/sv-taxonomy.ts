import type { ITaxonomy } from '~~/types/feed'
import type { SvCategory, SvPage, SvTagCount } from './sv'

/** story-verse 分页接口的 size 上限 */
const PAGE_SIZE = 50

async function fetchAll<T>(path: string, apiEntry: string): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const result = await $fetch<SvPage<T>>(path, { baseURL: apiEntry, query: { page, size: PAGE_SIZE } })
    all.push(...result.list)
    if (!result.hasNext || result.list.length === 0) return all
  }
}

/**
 * 全部有公开文章的分类和标签。分类保持后台的排序，标签按文章数倒序、名称正序。
 * 归档索引页和 sitemap 共用。
 */
export async function loadTaxonomy(apiEntry: string): Promise<ITaxonomy> {
  const [categories, tags] = await Promise.all([
    fetchAll<SvCategory>('/api/categories', apiEntry),
    fetchAll<SvTagCount>('/api/tags', apiEntry),
  ])
  return {
    categories: categories
      .filter(c => c.postCount > 0)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
      .map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description || '', postCount: c.postCount })),
    tags: tags.map(t => ({ name: t.name, count: t.count })),
  }
}
