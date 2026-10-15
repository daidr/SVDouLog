import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SV_SIGNATURE_HEADER = 'x-sv-signature'

/** 与 story-verse 的 SIGNATURE_TOLERANCE_SECONDS 一致：超出视为重放。 */
const TOLERANCE_SECONDS = 300

/**
 * 校验 `t=<unix 秒>,v1=<hex>` 形式的签名。签的是**原始**请求体，
 * 所以调用方必须拿 readRawBody 的结果，不能 JSON 重新序列化。
 */
export function verifySvSignature(secret: string, rawBody: string, header: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=', 2) as [string, string]))
  const t = Number(parts.t)
  if (!Number.isInteger(t) || !parts.v1) return false
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(parts.v1)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
