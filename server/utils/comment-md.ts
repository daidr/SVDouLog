import type { IReply } from '~~/types/feed'
import MarkdownIt from 'markdown-it'

import { fillEmptyLinkText } from './markdown'

/**
 * 评论的"有限子集"markdown 渲染器。
 *
 * 设计取舍：
 * - 用 `'zero'` 预设把所有 rule 默认关掉，再 enable 一组明确白名单：
 *   只支持链接、加粗 / 斜体、删除线、行内代码 + 必要的 text/escape/newline。
 *   不开 heading / list / blockquote / fence / table / image / html_inline / html_block
 *   等容易污染评论排版或被滥用的规则。
 * - `html: false`：原始 HTML 字符全部 escape，杜绝 v-html 注入风险。
 * - `linkify: true`：裸 URL 自动变 `<a>`，与 markdown 显式 link 一并享受
 *   `target=_blank` 处理。
 * - `breaks: true`：评论里的换行直接 `<br>`，避免用户期望换行却看到一整段。
 *
 * 调用方用 `md.renderInline()` 而非 `render()` —— 不要 `<p>` 包装，让评论
 * 内容作为 inline 文本流嵌入到外部容器中（外部还会在前面拼一个"回复 @xxx"
 * 前缀 span）。
 *
 * 在 BFF 里渲染而不是在浏览器里：markdown-it 连同 linkify / 实体表有五十多 KB，
 * 放在服务端，文章页的脚本就不用带它。
 */
const md = new MarkdownIt('zero', {
  html: false,
  linkify: true,
  breaks: true,
})
  .enable([
    // inline 元素白名单：emphasis 同时覆盖 ** ** 和 * *；strikethrough 是 ~~ ~~
    'emphasis',
    'strikethrough',
    'backticks',
    'link',
    'autolink',
    // 解析支撑：把字符流变 token，处理转义、换行、HTML 实体
    'text',
    'escape',
    'newline',
    'entity',
    // core 阶段：linkify 把裸 URL 升级成 link token
    'linkify',
    // 把 inline parser 接到 core pipeline 上；不开 inline 的话什么都不渲染
    'inline',
    // 预归一化（CRLF → LF 等）
    'normalize',
  ])

fillEmptyLinkText(md)

// 让所有 link 加 target=_blank + 安全 rel
const defaultLinkOpen = md.renderer.rules.link_open
  ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts))

md.renderer.rules.link_open = function linkOpen(tokens, idx, opts, env, self) {
  const token = tokens[idx]
  token.attrSet('target', '_blank')
  // noopener: 防 window.opener 钓鱼；noreferrer: 不泄露原页面；nofollow: 不
  // 给评论里贴的链接传递 SEO 权重（防 spam）
  token.attrSet('rel', 'noopener noreferrer nofollow')
  return defaultLinkOpen(tokens, idx, opts, env, self)
}

export function renderCommentMarkdown(content: string): string {
  return md.renderInline(content || '')
}

type RawReply = Omit<IReply, 'contentHtml'>
type RawTopLevel = RawReply & { repliesPreview?: RawReply[] }

function renderOne<T extends RawTopLevel>(comment: T) {
  const out: T & { contentHtml: string } = { ...comment, contentHtml: renderCommentMarkdown(comment.content) }
  if (Array.isArray(comment.repliesPreview)) {
    out.repliesPreview = comment.repliesPreview.map(r => renderOne(r))
  }
  return out
}

/** 评论列表响应：给每条评论（含楼中楼预览）补上渲染好的 `contentHtml`。错误响应原样返回 */
export function withCommentListHtml(data: unknown) {
  const list = (data as { list?: unknown } | null)?.list
  if (!Array.isArray(list)) return data
  return { ...(data as object), list: list.map(c => renderOne(c as RawTopLevel)) }
}

/** 发表评论的响应：approved 时带回的新评论补上 `contentHtml` */
export function withCreatedCommentHtml(data: unknown) {
  const created = (data as { data?: unknown } | null)?.data
  if (!created || typeof created !== 'object') return data
  return { ...(data as object), data: renderOne(created as RawTopLevel) }
}
