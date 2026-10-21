import { proxySvJson } from '../../utils/sv-client'

/**
 * 用读者账号订阅：邮箱已验证直接生效，否则 story-verse 发确认邮件。
 * 可带 { frequency } 选接收方式（每篇一封 / 每周摘要），已订阅时用来切换。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ frequency?: unknown } | undefined>(event).catch(() => undefined)
  const frequency = body?.frequency === 'instant' || body?.frequency === 'weekly' ? body.frequency : undefined
  return proxySvJson(event, '/api/subscriptions/me', { method: 'PUT', body: frequency ? { frequency } : undefined })
})
