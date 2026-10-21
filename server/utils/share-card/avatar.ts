import { Buffer } from 'node:buffer'
import { Resvg } from '@resvg/resvg-js'
import { loadImage } from './assets'

/**
 * 首页头像（app/components/ui/MainAvatar.vue 的默认形态）的静态版：圆环在下，头像放大
 * 1.25 倍、上移，按「圆环下半圆 + 上方敞开」的形状裁剪，所以头顶探出圆环；再加上三个装饰。
 * 几何按 MainAvatar 换算，`size` 是圆环内径。
 */
export interface AvatarLayout {
  size: number
  /** 圆环描边宽度 */
  stroke: number
  /** 合成图四周留给探出部分和装饰的边距 */
  pad: number
}

export function avatarLayout(size: number): AvatarLayout {
  return { size, stroke: size * 10 / 152, pad: Math.round(size * 0.3) }
}

/** 装饰图：宽度按头像尺寸的比例，位置按 MainAvatar 里 `.avatar-0` 的 left / right / bottom 百分比 */
const DECORATIONS = [
  { file: 'avatar_d2.png', width: 1 / 8, right: -0.1, bottom: 0.15 },
  { file: 'avatar_d3.png', width: 1 / 5, left: -0.15, bottom: -0.05 },
  { file: 'avatar_d4.png', width: 1 / 4, right: 0, bottom: -0.22 },
] as const

const cache = new Map<string, Promise<string>>()

/** 头像合成成一张 PNG（data URI），按圆环颜色缓存；渲染分辨率是显示尺寸的 2 倍 */
export function loadAvatarComposite(layout: AvatarLayout, ringColor: string) {
  const key = `${layout.size}:${ringColor}`
  let pending = cache.get(key)
  if (!pending) {
    pending = compose(layout, ringColor)
    pending.catch(() => cache.delete(key))
    cache.set(key, pending)
  }
  return pending
}

async function compose({ size: s, stroke, pad }: AvatarLayout, ringColor: string) {
  const avatar = await loadImage('avatar.png')
  const decorations = await Promise.all(DECORATIONS.map(async (d) => {
    const image = await loadImage(d.file)
    const width = s * d.width
    const height = width * image.height / image.width
    const x = 'left' in d ? s * d.left : s - s * d.right - width
    const y = s - s * d.bottom - height
    return `<image href="${image.uri}" x="${x}" y="${y}" width="${width}" height="${height}"/>`
  }))

  // MainAvatar 的 clip-path：两侧和上方各放宽，下方是圆环的下半段圆弧
  const side = s * 30 / 152
  const arcY = s / 2 / Math.SQRT2 + s / 2
  const arcInset = (s / 2) * (1 - 1 / Math.SQRT2)
  const clip = `M ${-side} ${-s / 2} L ${-side} ${arcY} L ${arcInset} ${arcY} A ${s / 2} ${s / 2} 0 0 0 ${s - arcInset} ${arcY} L ${s + side} ${arcY} L ${s + side} ${-s / 2} Z`
  const imageSize = s * 1.25
  const imageOffset = (s - imageSize) / 2

  const full = s + pad * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${full}" viewBox="${-pad} ${-pad} ${full} ${full}">
<defs><clipPath id="c"><path d="${clip}"/></clipPath></defs>
<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 + stroke / 2}" fill="none" stroke="${ringColor}" stroke-width="${stroke}"/>
<image href="${avatar.uri}" x="${imageOffset}" y="${imageOffset - s / 15}" width="${imageSize}" height="${imageSize}" clip-path="url(#c)"/>
${decorations.join('\n')}
</svg>`
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: full * 2 } }).render().asPng()
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
}
