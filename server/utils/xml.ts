/** XML 文本 / 属性转义。 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 包成 CDATA；正文里出现的 `]]>` 拆成两段，避免提前闭合。 */
export function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

/** 去掉末尾斜杠，拼接路径时不出现 `//`。 */
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
