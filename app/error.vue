<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

useAppShell()

const { t } = useI18n()

const notFound = computed(() => props.error.statusCode === 404)

useHead({
  meta: [{ name: 'robots', content: 'noindex' }],
})

if (import.meta.dev && !notFound.value) {
  console.error(props.error)
}

function retry() {
  // 重新加载出错的地址；clearError 只清状态不重取数据
  window.location.reload()
}
</script>

<template>
  <NuxtLayout>
    <SiteStatusCard
      :title="String(error.statusCode || 500)"
      :desc="notFound ? t('not_found.desc') : t('error_page.desc')"
      :on-retry="notFound ? undefined : retry"
    />
  </NuxtLayout>
</template>
