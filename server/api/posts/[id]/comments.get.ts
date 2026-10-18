import { withCommentListHtml } from '../../../utils/comment-md'
import { unlockHeaders } from '../../../utils/post-unlock'
import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 文章顶层评论列表（分页参数原样透传，由 story-verse 校验）。设了访问密码的要带上解锁 token。 */
export default defineEventHandler(async (event) => {
  const id = requireIdParam(event)
  return withCommentListHtml(await proxySvJson(event, `/api/posts/${id}/comments`, { query: getQuery(event), headers: unlockHeaders(event, id) }))
})
