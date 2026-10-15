import { proxySvJson, requireIdParam } from '../../../utils/sv-client'

/** 阅读量上报：带着读者身份转给 story-verse，由它按读者 30 分钟去重。 */
export default defineEventHandler((event) => {
  const id = requireIdParam(event)
  return proxySvJson(event, `/api/posts/${id}/view`, { method: 'POST' })
})
