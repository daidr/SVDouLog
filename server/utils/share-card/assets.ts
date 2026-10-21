import type { Font } from 'satori'
import { Buffer } from 'node:buffer'
import { shareCardEmojiBucket } from '../../../shared/utils/share-card'

/**
 * 分享图素材（构建时由 modules/share-card.ts 整理进 `assets:share-card`）的读取。
 * 都是只读素材，读过一次就留在进程内存里。
 */

interface FontSubset {
  key: string
  ranges: [number, number][]
}

const storage = () => useStorage('assets:share-card')

function memo<T>(load: () => Promise<T>) {
  let pending: Promise<T> | null = null
  return () => {
    pending ??= load().catch((error) => {
      pending = null
      throw error
    })
    return pending
  }
}

async function readJson<T>(key: string): Promise<T> {
  const value = await storage().getItem(key)
  if (value === null) throw new Error(`[share-card] missing asset ${key}`)
  return (typeof value === 'string' ? JSON.parse(value) : value) as T
}

async function readBinary(key: string): Promise<Uint8Array> {
  const value = await storage().getItemRaw(key)
  if (!value) throw new Error(`[share-card] missing asset ${key}`)
  return value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer)
}

const loadSubsets = memo(() => readJson<FontSubset[]>('subsets.json'))

/** 主题色板：每套 10 级，下标 0 对应站点的 `--color-primary-1` */
export const loadPalettes = memo(() => readJson<string[][]>('palette.json'))

function toDataUri(data: Uint8Array, type: string) {
  return `data:${type};base64,${Buffer.from(data).toString('base64')}`
}

const images = new Map<string, Promise<{ uri: string, width: number, height: number }>>()

/** 头像等 PNG 素材：data URI 和像素尺寸（取自 IHDR） */
export function loadImage(file: string) {
  let pending = images.get(file)
  if (!pending) {
    pending = readBinary(file).then((data) => {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
      return { uri: toDataUri(data, 'image/png'), width: view.getUint32(16), height: view.getUint32(20) }
    })
    pending.catch(() => images.delete(file))
    images.set(file, pending)
  }
  return pending
}
export const loadBackground = memo(async () => toDataUri(await readBinary('bg.svg'), 'image/svg+xml'))

/** 不复制的 Buffer 视图（Uint8Array 可能只是更大 ArrayBuffer 的一段，不能直接取 .buffer） */
function asBuffer(data: Uint8Array) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}

const fontCache = new Map<string, Promise<Uint8Array>>()

function loadFontFile(file: string) {
  let pending = fontCache.get(file)
  if (!pending) {
    pending = readBinary(`fonts/${file}`)
    pending.catch(() => fontCache.delete(file))
    fontCache.set(file, pending)
  }
  return pending
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

/**
 * 字体：按文字里实际出现的字符挑出 Noto Sans SC 的区段文件。每个区段在 satori 里注册成
 * 一个独立的字体名（`fontFamily` 里依次列出），缺字时 satori 才会去下一个字体里找。
 * emoji 不走字体，交给 loadEmoji 画成图片。
 */
export async function loadFonts(text: string, weights: Font['weight'][]) {
  const subsets = await loadSubsets()
  const used = new Set<FontSubset>()
  for (const char of text) {
    if (EMOJI_RE.test(char)) continue
    const code = char.codePointAt(0)!
    const subset = subsets.find(s => s.ranges.some(([start, end]) => code >= start && code <= end))
    if (subset) used.add(subset)
  }
  const families = [...used].map(s => `noto-sans-sc-${s.key}`)
  const fonts: Font[] = await Promise.all([...used].flatMap(subset => weights.map(async weight => ({
    name: `noto-sans-sc-${subset.key}`,
    weight,
    style: 'normal' as const,
    data: asBuffer(await loadFontFile(`${subset.key}-${weight}.woff`)),
  }))))
  return { fonts, fontFamily: families.join(', ') || 'sans-serif' }
}

const emojiBuckets = new Map<number, Promise<Record<string, string>>>()

function loadEmojiBucket(bucket: number) {
  let pending = emojiBuckets.get(bucket)
  if (!pending) {
    pending = readJson<Record<string, string>>(`emoji/${bucket}.json`)
    pending.catch(() => emojiBuckets.delete(bucket))
    emojiBuckets.set(bucket, pending)
  }
  return pending
}

/** 一个 emoji（字素）→ twemoji 的 svg data URI；没有对应图标时 undefined */
export async function loadEmoji(segment: string) {
  const codes = [...segment].map(char => char.codePointAt(0)!.toString(16))
  // twemoji 的 key 大多不带变体选择符 fe0f，先按原样找，找不到再去掉它
  const candidates = [codes.join('-'), codes.filter(code => code !== 'fe0f').join('-')]
  for (const key of new Set(candidates)) {
    const svg = (await loadEmojiBucket(shareCardEmojiBucket(key)))[key]
    if (svg) return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }
  return undefined
}
