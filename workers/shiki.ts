import { codeToHast, hastToHtml } from 'https://esm.sh/shiki@1.1.7'
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from 'https://esm.sh/@shikijs/transformers@1.1.7'
import type { Element } from 'hast'

// codeToHast 是 shiki 的捷径 API，内部维护一个单例 highlighter（WASM 引擎 + 主题 +
// 语法都缓存在模块作用域）。只要这个 worker 不被销毁，单例就一直活着——首次付初始化
// 代价，之后每条消息只是再 tokenize，毫秒级。因此调用方必须复用同一个常驻 worker，
// 而不是每次高亮新建/销毁 worker（否则单例随上下文销毁，每次都要重建引擎，极慢）。

const transformers = [
  transformerNotationDiff(),
  transformerNotationErrorLevel(),
  transformerNotationFocus(),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
]

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

addEventListener('message', async (event) => {
  const { id, lang, code } = event.data
  try {
    const result = await codeToHast(code, {
      lang,
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark',
      },
      transformers,
    })

    const preNode = result.children[0] as Element
    const codeNode = preNode.children[0] as Element

    postMessage({ id, html: hastToHtml(codeNode) })
  }
  catch {
    // 未知语言等异常：回退为纯文本 <code>，避免该请求永远不返回、卡在"处理中"
    postMessage({ id, html: `<code>${escapeHtml(code)}</code>` })
  }
})
