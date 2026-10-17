<script setup lang="ts">
import type { HighlightRange } from '~~/types/feed'

const props = defineProps<{ text: string, ranges: HighlightRange[] }>()

/** 按命中区间把文本切成普通段和高亮段；区间由服务端算好，已排序且不重叠 */
const parts = computed(() => {
  const out: { text: string, hit: boolean }[] = []
  let at = 0
  for (const [start, end] of props.ranges) {
    if (start > at) out.push({ text: props.text.slice(at, start), hit: false })
    out.push({ text: props.text.slice(start, end), hit: true })
    at = end
  }
  if (at < props.text.length) out.push({ text: props.text.slice(at), hit: false })
  return out
})
</script>

<template>
  <template v-for="(part, i) of parts" :key="i">
    <mark v-if="part.hit" class="highlight">{{ part.text }}</mark>
    <template v-else>
      {{ part.text }}
    </template>
  </template>
</template>

<style scoped lang="scss">
.highlight {
  @apply bg-primary-2/70 dark-bg-primary-4/60 text-inherit rounded px-0.5;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
</style>
