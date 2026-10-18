<script setup lang="ts">
// 没有匹配的路由：交给 error.vue 显示 404，服务端同时回 404 状态码
throw pageError()
</script>

<template>
  <div />
</template>
