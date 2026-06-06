<script setup lang="ts">
import type { Element } from 'hast'
import { decode } from 'blurhash'

const props = defineProps<{ node: Element }>()

// 后端按媒体清单回填的占位数据（仅用于加载占位，不落到 <img> 属性上）
const blurhash = computed(() => String(props.node.properties?.dataBlurhash ?? ''))
const color = computed(() => String(props.node.properties?.dataColor ?? ''))

// 透传给 <img> 的属性：src / alt / width / height / class …，剔除 data-* 占位属性
// 与可能的 style（占位 style 由本组件独立控制，避免双写冲突）
const imgProps = computed(() => {
  const all = normalizeProperties(props.node.properties)
  const { dataBlurhash, dataColor, style, ...rest } = all
  return rest
})

const loaded = ref(false)
const blurDataUrl = ref<string | null>(null)

// BlurHash → data URL：canvas 解码只能在客户端做（SSR 无 canvas），hydrate 后出现。
// width/height 属性已让浏览器预留 aspect-ratio 盒子，所以即使占位晚一拍也不抖动。
onMounted(() => {
  if (!blurhash.value || typeof document === 'undefined') return
  try {
    const size = 32
    const pixels = decode(blurhash.value, size, size)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imageData = ctx.createImageData(size, size)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
    blurDataUrl.value = canvas.toDataURL()
  }
  catch {
    // 非法 blurhash：忽略，退回纯色 / 无占位
  }
})

// 加载完成前用 blurHash（无则主题色）铺在图片盒子里；加载后撤掉占位，避免
// 透明 PNG 背后残留模糊。
const placeholderStyle = computed<Record<string, string>>(() => {
  if (loaded.value) return {}
  const style: Record<string, string> = {}
  if (color.value) style.backgroundColor = color.value
  if (blurDataUrl.value) {
    style.backgroundImage = `url(${blurDataUrl.value})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  return style
})
</script>

<template>
  <CommonImageZoom v-bind="imgProps" :style="placeholderStyle" @load="loaded = true" />
</template>
