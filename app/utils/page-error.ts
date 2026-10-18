/**
 * 页面主体数据取不到时抛给 error.vue 的错误。后端说不存在（4xx）或根本没取到就是 404；
 * 后端出错、超时（5xx 或连不上）照实给 5xx，不能当成 404，否则一次后端故障会让读者和
 * 搜索引擎以为文章被删了。fatal 让客户端跳转时也显示出错页。
 */
export function pageError(err?: { statusCode?: number } | null) {
  const status = err?.statusCode
  const statusCode = !err || (status && status < 500) ? 404 : status || 503
  return createError({ statusCode, statusMessage: statusCode === 404 ? 'Page Not Found' : 'Service Unavailable', fatal: true })
}
