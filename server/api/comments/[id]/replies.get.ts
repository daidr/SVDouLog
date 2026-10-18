import { withCommentListHtml } from '../../../utils/comment-md'
import { unlockHeaders } from '../../../utils/post-unlock'
import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/**
 * 某条顶层评论下的回复（分页参数原样透传）。页面顺带传 `postId`：文章设了访问密码时
 * 按它取出那一篇的解锁 token，这个参数本身不转给 story-verse。
 */
export default defineEventHandler(async (event) => {
  const id = requireIdParam(event)
  const { postId, ...query } = getQuery(event)
  const post = Number(postId)
  const headers = Number.isInteger(post) && post > 0 ? unlockHeaders(event, post) : {}
  return withCommentListHtml(await proxySvJson(event, `/api/comments/${id}/replies`, { query, headers }))
})
