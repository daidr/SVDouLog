import { proxySvJson } from '../../utils/sv-client'

/** 登录读者的订阅状态（带 session cookie 转给 story-verse）。 */
export default defineEventHandler(event => proxySvJson(event, '/api/subscriptions/me'))
