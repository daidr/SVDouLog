import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 当前读者对这篇文章的点赞状态（按读者 IP+UA / 登录态区分，不缓存）。 */
export default defineEventHandler((event) => {
  const id = requireIdParam(event)
  return proxySvJson(event, `/api/posts/${id}/like`)
})
