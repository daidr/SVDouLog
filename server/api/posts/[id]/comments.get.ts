import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 文章顶层评论列表（分页参数原样透传，由 story-verse 校验）。 */
export default defineEventHandler((event) => {
  const id = requireIdParam(event)
  return proxySvJson(event, `/api/posts/${id}/comments`, { query: getQuery(event) })
})
