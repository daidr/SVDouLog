<script setup lang="ts">
// 实时预览专用的极简布局：只保留正文承载容器，去掉站点导航 / 页脚 /
// 背景几何图形 / PWA 等外壳，让 iframe 内呈现「纯净文章视图」。
// 暗色 class 由 app.vue 的全局 htmlAttrs 统一驱动，这里无需处理。
</script>

<template>
  <div class="preview-shell">
    <slot />
  </div>
</template>

<style scoped lang="scss">
// 全局 html / #__daidr_app 都是 overflow:hidden 的固定全屏盒，文档本身不滚动。
// 预览壳填满固定根（h-full），真正的滚动交给页面内的滚动容器（.preview-page）。
.preview-shell {
  @apply bg-primary-2 h-full;
  @apply text-dark dark-text-light;
}
</style>
