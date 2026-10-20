import type { ShareCardContent } from '../../../shared/utils/share-card'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../../../shared/utils/share-card'
import { loadAvatar, loadBackground, loadEmoji, loadFonts } from './assets'

type Style = Record<string, string | number>
interface Node {
  type: string
  props: { style?: Style, children?: Child | Child[], [key: string]: unknown }
}
type Child = Node | string | null

function h(type: string, props: Node['props'], ...children: Child[]): Node {
  const kids = children.filter(child => child !== null)
  return { type, props: { ...props, children: kids.length === 1 ? kids[0] : kids } }
}

/** 白色卡片离图片边缘的距离 */
const CARD_INSET = 48

const WIDE_SCRIPT_RE = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u

/** 按「视觉宽度」估长度：汉字、假名、全角标点等算 1，其余算 0.55 */
function visualLength(text: string) {
  let length = 0
  for (const char of text) {
    const code = char.codePointAt(0)!
    // CJK 标点（U+3000–303F）和全角 ASCII（U+FF00–FF60）
    const wide = WIDE_SCRIPT_RE.test(char) || (code >= 0x3000 && code <= 0x303F) || (code >= 0xFF00 && code <= 0xFF60)
    length += wide ? 1 : 0.55
  }
  return length
}

/** 标题越长字越小，最多占三行（没有摘要时四行），再长截断 */
function titleStyle(title: string, hasSummary: boolean) {
  const length = visualLength(title)
  const fontSize = length <= 28 ? 68 : length <= 44 ? 58 : 50
  return { fontSize, lineClamp: hasSummary ? 3 : 4 }
}

/**
 * 画一张 1200×630 的分享图，配色和版式取自阅读端：主题浅色底 + 背景纹样，白色圆角卡片里
 * 是标题、摘要，底部头像、博主名和站点名。`palette` 是一套主题的 10 级颜色。
 */
export async function renderShareCard(content: ShareCardContent, palette: string[]): Promise<Uint8Array> {
  const [avatar, background] = await Promise.all([loadAvatar(), loadBackground()])
  const text = [content.title, content.summary ?? '', content.authorName, content.authorHandle, content.siteName, '@…'].join('')
  const { fonts, fontFamily } = await loadFonts(text, [400, 700])
  const color = (step: number) => palette[step - 1]!
  const title = titleStyle(content.title, content.summary !== null)

  const tree = h('div', {
    style: {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      display: 'flex',
      backgroundColor: color(2),
      fontFamily,
    },
  }, h('img', {
    src: background,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    style: { position: 'absolute', left: 0, top: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, objectFit: 'cover' },
  }), h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      boxSizing: 'border-box',
      left: CARD_INSET,
      top: CARD_INSET,
      width: SHARE_CARD_WIDTH - CARD_INSET * 2,
      height: SHARE_CARD_HEIGHT - CARD_INSET * 2,
      padding: '60px 72px 52px',
      borderRadius: 40,
      backgroundColor: '#ffffff',
    },
  }, h('div', {
    style: {
      display: 'block',
      fontSize: title.fontSize,
      lineHeight: 1.3,
      fontWeight: 700,
      color: color(5),
      lineClamp: title.lineClamp,
    },
  }, content.title), content.summary
    ? h('div', {
        style: {
          display: 'block',
          marginTop: 24,
          fontSize: 28,
          lineHeight: 1.6,
          color: color(4),
          lineClamp: 2,
        },
      }, content.summary)
    : null, h('div', {
    style: { display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: 32 },
  }, h('img', {
    src: avatar,
    width: 88,
    height: 88,
    style: { width: 88, height: 88, boxSizing: 'border-box', borderRadius: '50%', border: `5px solid ${color(2)}` },
  }), h('div', {
    style: { display: 'flex', alignItems: 'baseline', marginLeft: 20, color: color(5) },
  }, h('span', { style: { fontSize: 32, fontWeight: 700 } }, content.authorName), h('span', {
    style: { marginLeft: 12, fontSize: 24, color: color(4) },
  }, `@${content.authorHandle}`)), h('div', {
    style: { display: 'flex', marginLeft: 'auto', paddingLeft: 32, fontSize: 26, fontWeight: 700, color: color(4) },
  }, content.siteName))))

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    fonts,
    loadAdditionalAsset: async (code, segment) => (code === 'emoji' && await loadEmoji(segment)) || [],
  })
  return new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_CARD_WIDTH } }).render().asPng()
}
