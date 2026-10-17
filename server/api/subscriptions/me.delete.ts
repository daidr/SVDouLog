import { proxySvJson } from '../../utils/sv-client'

/** 读者账号退订。 */
export default defineEventHandler(event => proxySvJson(event, '/api/subscriptions/me', { method: 'DELETE' }))
