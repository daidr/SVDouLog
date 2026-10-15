import type { SvContentChangeEvent } from '../utils/sv'
import { invalidateForChange } from '../utils/sv-cache'
import { SV_SIGNATURE_HEADER, verifySvSignature } from '../utils/sv-webhook'

/**
 * story-verse 内容变更通知的接收端：
 *   POST /api/sv-webhook
 *   x-sv-signature: t=<sec>,v1=<hmac>
 *
 * 在 story-verse 后台「前端站点通知」里把地址填成这里、密钥填成 NUXT_SV_WEBHOOK_SECRET。
 * 未配置密钥时接口关闭（404）。
 */
export default defineEventHandler(async (event) => {
  const { svWebhookSecret } = useRuntimeConfig(event)
  if (!svWebhookSecret) {
    throw createError({ statusCode: 404 })
  }

  const rawBody = (await readRawBody(event, 'utf8')) ?? ''
  const signature = getHeader(event, SV_SIGNATURE_HEADER) ?? ''
  if (!signature || !verifySvSignature(svWebhookSecret, rawBody, signature)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  }

  let change: SvContentChangeEvent
  try {
    change = JSON.parse(rawBody)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }
  if (change.event !== 'content.changed') {
    // 未来新增的事件类型：签名合法就收下，不做处理，避免 story-verse 反复重试
    return { ok: true, cleared: 0 }
  }

  const cleared = await invalidateForChange(change)
  return { ok: true, cleared }
})
