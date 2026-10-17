import { withCreatedCommentHtml } from '../../utils/comment-md'
import { proxySvJson } from '../../utils/sv-client'

/**
 * 发表评论（登录用户或访客昵称 + 邮箱）。请求体原样转给 story-verse，校验、
 * 反垃圾和限速都在那边按读者 IP 做。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return withCreatedCommentHtml(await proxySvJson(event, '/api/comments', { method: 'POST', body }))
})
