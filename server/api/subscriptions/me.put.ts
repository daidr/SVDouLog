import { proxySvJson } from '../../utils/sv-client'

/** 用读者账号订阅：邮箱已验证直接生效，否则 story-verse 发确认邮件。 */
export default defineEventHandler(event => proxySvJson(event, '/api/subscriptions/me', { method: 'PUT' }))
