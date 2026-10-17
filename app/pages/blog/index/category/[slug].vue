<script setup lang="ts">
definePageMeta({
  isInArticlePage: false,
})

// 这一页在 keepalive 里，参数在创建时取定，离开后 route 已经是别的页面
const slug = String(useRoute().params.slug ?? '')
</script>

<template>
  <SiteArchivePage :filter="{ category: slug }" />
</template>
