/**
 * 文章详情的缓存 handler：先校验 `:id` 是整数，再交给 cachedEventHandler。
 *
 * 阅读量不在这里累加——缓存命中时服务端根本不回源，在这里计数会漏算；
 * 改由读者浏览器打开文章后直接 POST story-verse `/api/posts/:id/view`
 * （见 app/pages/blog/index/[slug].vue），身份按读者自己的 IP/UA/登录态去重。
 */
export const defineCountableCachedEventHandler: typeof cachedEventHandler = (
  ...args: Parameters<typeof cachedEventHandler>
) => {
  const originHandler = cachedEventHandler(...args)
  return eventHandler((event) => {
    const articleID = (getRouterParam(event, 'id') as unknown as number) - 0

    if (Number.isNaN(articleID)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID should be an integer',
      })
    }

    return originHandler(event)
  })
}
