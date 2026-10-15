import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 切换点赞。 */
export default defineEventHandler((event) => {
  const id = requireIdParam(event)
  return proxySvJson(event, `/api/posts/${id}/like`, { method: 'POST' })
})
