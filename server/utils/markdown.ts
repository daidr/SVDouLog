import type { SvPostMediaItem } from './sv'
import MarkdownIt from 'markdown-it'

import mdContainer from 'markdown-it-container'
import { buildMediaSrcset } from './sv'

/**
 * markdown-it plugin：把 `[](href)` 这种 label 为空的 link，自动用 href 当
 * 显示文本。
 *
 * 实现位置选 core ruler 而不是 link_open renderer：core 阶段我们能直接看到
 * `link_open` 和 `link_close` 两个相邻 token 之间是否有 inline children，
 * 没有就 splice 一个 text token 进去。renderer 阶段无法回头插 token。
 *
 * 同样的实现复制了一份在 `app/utils/comment-md.ts` 里给评论用——两份代码
 * 都很短，写成共享 plugin 文件需要跨 server/ 与 app/ 边界，不值得。
 */
function fillEmptyLinkText(md: MarkdownIt) {
  md.core.ruler.after('inline', 'fill_empty_link_text', (state) => {
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue
      const children = blockToken.children
      for (let i = 0; i < children.length; i++) {
        const tok = children[i]
        if (!tok || tok.type !== 'link_open') continue
        const next = children[i + 1]
        if (!next || next.type !== 'link_close') continue
        const href = tok.attrGet('href') || ''
        if (!href) continue
        const textToken = new state.Token('text', '', 0)
        textToken.content = href
        children.splice(i + 1, 0, textToken)
        i++ // 跳过新插入的 text token
      }
    }
    return false
  })
}

/**
 * 正文图片的显示宽度：文章栏最宽 856px，窄于 1200px 的屏幕上侧栏收起、正文铺满。
 * 与 `app/pages/blog/index/[slug].vue` 的布局一致。
 */
export const ARTICLE_IMAGE_SIZES = '(max-width: 1200px) 100vw, 856px'

export interface RenderOptions {
  /**
   * 正文里 `/api/...` 形态的相对地址（主要是 `/api/media/raw/...`）的前缀。
   * 站内页面留空：这些路径由本站的媒体代理提供；站外消费（RSS）传站点绝对地址。
   */
  assetBase?: string
  /**
   * 文章正文引用到的媒体清单。后端已把正文里的 `@<id>` 引用反解成
   * `/api/media/raw/<id>?webp=true`；这里按 id 把 width/height/blurHash/
   * prominentColor 回填到 `<img>` 属性上，让前端固定盒子尺寸、加占位、消抖。
   */
  media?: SvPostMediaItem[]
}

/**
 * 创建一个绑定了具体 assetBase 的 markdown-it 实例。
 *
 * 选项：
 *   - `html: true`：保留作者在 markdown 里手写的 HTML 片段（如 <video>、<iframe>），
 *     这是 douLog 既有内容（旧 WP HTML 已用 hast 渲染）保持等价能力的关键。
 *   - `linkify: true`：让裸链接自动变成 <a>。
 *   - `breaks: false`：单换行不视为 <br>，行为与 GFM 默认一致。
 *
 * 自定义扩展：
 *   - `:::gallery ... :::` 容器：将一组 markdown 图片打包成一个轮播容器；
 *     在 hast 阶段由前端 `PartGallery` 组件接管渲染。
 *   - 传了 assetBase 时，图片 src 的 `/api/` 相对路径补成以它开头的绝对 URL。
 */
function createRenderer(options: RenderOptions): MarkdownIt {
  const assetBase = (options.assetBase ?? '').replace(/\/+$/, '')
  // 媒体清单按 id 建索引：image renderer 据此把尺寸 / blurHash / 主题色回填到 <img>
  const mediaById = new Map<number, SvPostMediaItem>()
  for (const m of options.media ?? []) mediaById.set(m.id, m)

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
  })
  fillEmptyLinkText(md)

  // ::: gallery ::: 容器 → 一个带类名的 div，由前端识别后渲染为轮播图。
  // 不在 markdown-it 这层做"提取图片列表"的工作，因为容器内还可能含有
  // markdown 段落 / 链接 / emoji 等，让 hast 端按节点结构去取更稳。
  md.use(mdContainer, 'gallery', {
    render(tokens, idx) {
      if (tokens[idx].nesting === 1) {
        return '<div class="custom-block custom-block-gallery">\n'
      }
      return '</div>\n'
    },
  })

  // ::: github ::: 容器 → 让前端 PartGithubCard 接管。容器内通常是一行
  // GitHub 仓库 URL（被 linkify 自动转成 <a>），hast 端从 anchor href
  // 提取 owner/repo 调 `/api/github/:owner/:repo` 拉数据。
  md.use(mdContainer, 'github', {
    render(tokens, idx) {
      if (tokens[idx].nesting === 1) {
        return '<div class="custom-block custom-block-github">\n'
      }
      return '</div>\n'
    },
  })

  // 重写 image renderer：把 `/api/` 开头的相对路径变绝对路径。其他 src
  // （含完整的 http/https URL、自定义 CDN）原样保留。
  const defaultImageRender = md.renderer.rules.image
  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    const srcIndex = token.attrIndex('src')
    if (srcIndex >= 0) {
      const src = token.attrs![srcIndex][1]
      // 解出媒体 id，支持两种形态：
      //   - `/api/media/raw/<id>?webp=true`：公开接口已反解的真实 URL（正式渲染路径）
      //   - `@<id>`：原始存储引用（编辑器预览直接送原文 markdown 时出现）——这里
      //     就地反解成真实路径，让预览也能出图，不必依赖上游先反解
      let mediaId: number | null = null
      const refMatch = src.match(/^@(\d+)$/)
      if (refMatch) {
        mediaId = Number(refMatch[1])
        token.attrs![srcIndex][1] = `/api/media/raw/${mediaId}?webp=true`
      } else {
        const urlMatch = src.match(/\/api\/media\/raw\/(\d+)/)
        if (urlMatch) mediaId = Number(urlMatch[1])
      }

      // 按清单回填尺寸 / 占位数据。width/height 让浏览器预留 aspect-ratio 盒子
      // （配合 CSS height:auto + max-width:100%）→ 加载前不抖动；blurHash / 主题色
      // 交给前端做加载占位。预览路径暂无清单时跳过，图片仍可正常显示。
      if (mediaId != null) {
        const entry = mediaById.get(mediaId)
        if (entry) {
          if (entry.width) token.attrSet('width', String(entry.width))
          if (entry.height) token.attrSet('height', String(entry.height))
          if (entry.blurHash) token.attrSet('data-blurhash', entry.blurHash)
          if (entry.prominentColor) token.attrSet('data-color', entry.prominentColor)
          // 正文用的是完整 webp 时补上各档宽度：手机只下载够用的那档。点开放大要看原宽，
          // 放大图走 data-zoom-src（medium-zoom 放大时去掉 srcset 换成它）
          if (entry.width && entry.mimeType.startsWith('image/') && token.attrs![srcIndex][1] === `/api/media/raw/${mediaId}?webp=true`) {
            token.attrSet('srcset', buildMediaSrcset(mediaId, { width: entry.width }))
            token.attrSet('sizes', ARTICLE_IMAGE_SIZES)
            token.attrSet('data-zoom-src', token.attrs![srcIndex][1])
          }
        }
      }

      // `/api/...` 相对路径按需补成绝对 URL（含上面刚反解出来的 @<id>）
      if (assetBase) {
        for (const name of ['src', 'data-zoom-src']) {
          const value = token.attrGet(name)
          if (value?.startsWith('/api/')) token.attrSet(name, `${assetBase}${value}`)
        }
        const srcset = token.attrGet('srcset')
        if (srcset) token.attrSet('srcset', srcset.replace(/(^|, )\/api\//g, `$1${assetBase}/api/`))
      }
    }
    return defaultImageRender
      ? defaultImageRender(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts)
  }

  // 文章正文里指向"绝对外链"（http(s) + 任意域）的 a 标签统一加 target=_blank：
  //   - 站点内的相对锚点（`#h-xxx`）/ 站内相对路径不动，避免破坏单页内跳转
  //   - 绝对 URL 一律新窗口打开，并加上 noopener/noreferrer 避免 window.opener
  //     钓鱼与 referrer 泄露
  const defaultLinkOpen = md.renderer.rules.link_open
    ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    const href = token.attrGet('href') || ''
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank')
      const existing = token.attrGet('rel')
      const rel = existing ? `${existing} noopener noreferrer` : 'noopener noreferrer'
      token.attrSet('rel', rel)
    }
    return defaultLinkOpen(tokens, idx, opts, env, self)
  }

  return md
}

export function renderMarkdown(content: string, options: RenderOptions = {}): string {
  const md = createRenderer(options)
  return md.render(content)
}
