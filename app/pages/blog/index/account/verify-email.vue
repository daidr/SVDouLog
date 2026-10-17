<script setup lang="ts">
definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.verify_title')) })

// 验证链接经 /api/auth/verify-email 处理后跳来；失败时带 ?error=
const route = useRoute()
const failed = computed(() => !!route.query.error)

// 验证成功会顺带登录（story-verse 开了 autoSignInAfterVerification）
const { refresh } = useReaderAccount()
onMounted(refresh)
</script>

<script lang="ts">
export default {
  name: 'AccountVerifyEmail',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.verify_title')">
    <div class="auth-body">
      <p class="auth-notice">
        {{ failed ? t('account.errors.link_invalid') : t('account.verified') }}
      </p>
      <NuxtLink class="auth-btn" to="/blog/account">
        {{ t('account.title') }}
      </NuxtLink>
    </div>
  </SiteAuthPanel>
</template>
