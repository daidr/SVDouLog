import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { defineNuxtModule } from '@nuxt/kit'
import { dirname, join } from 'pathe'
import { compileString } from 'sass'
import { SHARE_CARD_EMOJI_BUCKETS, shareCardEmojiBucket } from '../shared/utils/share-card'

/** 分享图用到的字重：标题 700，其余 400 */
const FONT_WEIGHTS = [400, 700] as const

/** `U+4e00-9fff,U+3000` → [[0x4e00, 0x9fff], [0x3000, 0x3000]] */
function parseUnicodeRange(range: string): [number, number][] {
  return range.split(',').map((part) => {
    const [start, end] = part.trim().replace(/^U\+/i, '').split('-') as [string, string?]
    return [Number.parseInt(start, 16), Number.parseInt(end ?? start, 16)]
  })
}

/**
 * 主题色板：编译 app/assets/scss/_theme.scss，取浅色模式下每个 `.theme-N` 的
 * `--color-primary-1..10`。和站点用的是同一份 SCSS，主题色改了分享图跟着变。
 */
function compileThemePalettes(scssDir: string) {
  const { css } = compileString('@use "theme";', { loadPaths: [scssDir] })
  const palettes: string[][] = []
  for (const [, index, body] of css.matchAll(/^\.theme-(\d+) \{([^}]*)\}/gm)) {
    const colors: string[] = []
    for (const [, step, value] of body!.matchAll(/--color-primary-(\d+): ([^;]+);/g)) {
      const rgb = value!.split(',').map(v => Math.round(Number(v)))
      colors[Number(step) - 1] = `rgb(${rgb.join(', ')})`
    }
    palettes[Number(index) - 1] = colors
  }
  if (!palettes.length) throw new Error('[share-card] no .theme-N palette found in _theme.scss')
  return palettes
}

/**
 * 文章分享图（server/routes/og）用的静态资源，构建时整理进 Nitro 的 server assets
 * （`assets:share-card`）：
 *   - fonts/：Noto Sans SC 按 Unicode 区段切好的 woff（satori 不认 woff2），渲染时只加载
 *     标题等文字实际用到的区段
 *   - emoji/：twemoji 的 svg，按 key 分桶
 *   - palette.json、avatar.png、bg.svg：站点主题色、头像和背景纹样
 *
 * 资源和渲染代码的散列作为 `runtimeConfig.public.shareCardRevision`，进到分享图地址里：
 * 改了版式或素材，地址跟着变，社交平台和 CDN 不会继续用旧图。
 */
export default defineNuxtModule({
  meta: {
    name: 'doulog:share-card',
  },
  async setup(_options, nuxt) {
    const rootDir = nuxt.options.rootDir
    const require = createRequire(join(rootDir, 'package.json'))
    const fontDir = dirname(require.resolve('@fontsource/noto-sans-sc/package.json'))
    const twemojiDir = dirname(require.resolve('@iconify-json/twemoji/package.json'))
    const outDir = join(nuxt.options.buildDir, 'share-card')

    // 先在内存里备好要写的文件、算出版本散列；真正写盘放到 build:before：nuxi build 在加载
    // 完模块之后才清空 buildDir，在这里直接写会被清掉
    const copies: { from: string, to: string }[] = []
    const writes: { to: string, data: string | Buffer }[] = []
    const revision = createHash('sha256')

    // 字体区段：unicode.json 的 key 形如 `[118]`、`latin`，文件名里是去掉方括号的部分
    const unicode = JSON.parse(await readFile(join(fontDir, 'unicode.json'), 'utf8')) as Record<string, string>
    const subsets = Object.entries(unicode).map(([key, range]) => ({
      key: key.replace(/^\[|\]$/g, ''),
      ranges: parseUnicodeRange(range),
    }))
    for (const { key } of subsets) {
      for (const weight of FONT_WEIGHTS) {
        copies.push({ from: join(fontDir, 'files', `noto-sans-sc-${key}-${weight}-normal.woff`), to: `fonts/${key}-${weight}.woff` })
      }
    }
    const subsetsJson = JSON.stringify(subsets)
    writes.push({ to: 'subsets.json', data: subsetsJson })
    revision.update(subsetsJson)
    revision.update(JSON.parse(await readFile(join(fontDir, 'package.json'), 'utf8')).version)

    // emoji：chars.json 是「码位序列 → 图标名」，icons.json 里是图标的 svg body
    const chars = JSON.parse(await readFile(join(twemojiDir, 'chars.json'), 'utf8')) as Record<string, string>
    const icons = JSON.parse(await readFile(join(twemojiDir, 'icons.json'), 'utf8')) as {
      icons: Record<string, { body: string, width?: number, height?: number }>
      aliases?: Record<string, { parent: string }>
      width?: number
      height?: number
    }
    const buckets: Record<string, string>[] = Array.from({ length: SHARE_CARD_EMOJI_BUCKETS }, () => ({}))
    for (const [key, name] of Object.entries(chars)) {
      const icon = icons.icons[name] ?? icons.icons[icons.aliases?.[name]?.parent ?? '']
      if (!icon) continue
      const width = icon.width ?? icons.width ?? 16
      const height = icon.height ?? icons.height ?? 16
      buckets[shareCardEmojiBucket(key)]![key] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`
    }
    buckets.forEach((bucket, i) => writes.push({ to: `emoji/${i}.json`, data: JSON.stringify(bucket) }))
    revision.update(JSON.parse(await readFile(join(twemojiDir, 'package.json'), 'utf8')).version)

    const paletteJson = JSON.stringify(compileThemePalettes(join(rootDir, 'app/assets/scss')))
    writes.push({ to: 'palette.json', data: paletteJson })
    revision.update(paletteJson)

    for (const file of ['avatar.png', 'bg.svg']) {
      const data = await readFile(join(rootDir, 'public/images', file))
      writes.push({ to: file, data })
      revision.update(data)
    }

    // 版式本身：渲染代码和决定卡片内容的共享代码
    const rendererDir = join(rootDir, 'server/utils/share-card')
    for (const file of (await readdir(rendererDir)).sort()) {
      revision.update(await readFile(join(rendererDir, file)))
    }
    revision.update(await readFile(join(rootDir, 'shared/utils/share-card.ts')))

    nuxt.hook('build:before', async () => {
      await rm(outDir, { recursive: true, force: true })
      await mkdir(join(outDir, 'fonts'), { recursive: true })
      await mkdir(join(outDir, 'emoji'), { recursive: true })
      await Promise.all([
        ...copies.map(({ from, to }) => copyFile(from, join(outDir, to))),
        ...writes.map(({ to, data }) => writeFile(join(outDir, to), data)),
      ])
    })

    nuxt.options.runtimeConfig.public.shareCardRevision = revision.digest('hex').slice(0, 8)

    nuxt.hook('nitro:config', (config) => {
      config.serverAssets ||= []
      config.serverAssets.push({ baseName: 'share-card', dir: outDir })
    })
  },
})
