import { proxySvJson } from '../../utils/sv-client'

/**
 * 用邮箱订阅新文章。请求体（email / frequency / turnstileToken / 蜜罐 website_url）原样转给
 * story-verse，校验、限速和 Turnstile 都在那边按读者 IP 做；它会发确认邮件。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxySvJson(event, '/api/subscriptions', { method: 'POST', body })
})
