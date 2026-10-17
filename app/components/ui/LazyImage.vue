<script setup lang="ts">
import { decode } from 'blurhash'

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: '',
  },
  srcset: {
    type: String,
    default: undefined,
  },
  sizes: {
    type: String,
    default: undefined,
  },
  /** BlurHash 字符串：图片加载前显示的渐进式模糊占位 */
  blurhash: {
    type: String,
    default: '',
  },
  /**
   * 首屏关键图（头像、首屏封面）：立即以高优先级加载，不做淡入。
   * 其余图片交给浏览器原生懒加载。
   */
  eager: {
    type: Boolean,
    default: false,
  },
})

const imgEl = ref<HTMLImageElement>()

// <img> 随 SSR 直接输出，浏览器解析到 HTML 就开始加载，不必等 hydrate。
// 只有 hydrate 时还没加载完的图片才进入淡入流程：服务端渲染的初始状态是「可见」，
// 挂载后发现未完成再隐藏、等 load 事件淡入。已经加载完的（含 hydrate 前就完成、
// 错过了 load 事件的）保持原样。
const pending = ref(false)

onMounted(() => {
  const img = imgEl.value
  if (props.eager || !img || img.complete) return
  pending.value = true
})

function onLoad() {
  pending.value = false
}

// BlurHash → data URL：canvas 解码只能在客户端做（SSR 无 canvas），
// 因此占位在 hydrate 后出现。非法 hash 静默跳过。
const blurDataUrl = ref<string | null>(null)
onMounted(() => {
  if (!props.blurhash || imgEl.value?.complete) return
  try {
    const size = 32
    const pixels = decode(props.blurhash, size, size)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const imageData = ctx.createImageData(size, size)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
    blurDataUrl.value = canvas.toDataURL()
  } catch {
    // 非法 blurhash：忽略，不显示占位
  }
})
</script>

<template>
  <div class="lazy-image">
    <div
      v-if="blurDataUrl && pending"
      class="blurhash"
      :style="{ backgroundImage: `url(${blurDataUrl})` }"
    />
    <img
      ref="imgEl"
      class="img"
      :class="{ pending }"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      @load="onLoad"
    >
  </div>
</template>

<style scoped lang="scss">
.lazy-image {
  @apply w-full h-full overflow-hidden relative;

  .blurhash {
    @apply absolute inset-0 w-full h-full pointer-events-none;
    background-size: cover;
    background-position: center;
  }

  .img {
    @apply w-full h-full opacity-100;
    @apply transition-opacity duration-300 motion-reduce:transition-none;

    &.pending {
      @apply opacity-0 absolute pointer-events-none;
    }
  }
}
</style>
