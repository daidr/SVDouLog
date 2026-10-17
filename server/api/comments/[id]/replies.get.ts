import { withCommentListHtml } from '../../../utils/comment-md'
import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 某条顶层评论下的回复（分页参数原样透传）。 */
export default defineEventHandler(async (event) => {
  const id = requireIdParam(event)
  return withCommentListHtml(await proxySvJson(event, `/api/comments/${id}/replies`, { query: getQuery(event) }))
})
