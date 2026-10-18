/**
 * 文章在本站的正式地址：有 slug 用 `/blog/<slug>`，没有用 `/blog/<id>`。
 * 全是数字的 slug 会被当成 id，所以也用 id。story-verse 的永久链接（`{slug}` 模板，
 * `shared/permalink.ts`）是同一套规则，两边要一致，邮件和站内的链接才指向同一个地址。
 */
export function postPath(post: { id: number, slug?: string | null }): string {
  return `/blog/${isRoutableSlug(post.slug) ? encodeURIComponent(post.slug) : post.id}`
}

export function isRoutableSlug(slug: string | null | undefined): slug is string {
  return !!slug && !/^\d+$/.test(slug)
}
