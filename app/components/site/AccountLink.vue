<script setup lang="ts">
import IconUser from '~icons/mingcute/user-3-line'

const { t } = useI18n()
const route = useRoute()
const { account } = useReaderAccount()

const to = computed(() => account.value
  ? '/blog/account'
  : { path: '/blog/account/sign-in', query: { redirect: route.fullPath } })
const label = computed(() => account.value ? t('account.title') : t('account.sign_in'))
const avatarUrl = computed(() => account.value
  && (account.value.image || `https://cravatar.cn/avatar/${account.value.emailHash}?d=mp&s=64`))
</script>

<template>
  <NuxtLink :to="to" class="account-link" :title="label" :aria-label="label">
    <img v-if="avatarUrl" :src="avatarUrl" alt="" class="account-link__avatar" width="24" height="24">
    <IconUser v-else />
  </NuxtLink>
</template>

<style lang="scss" scoped>
.account-link {
  @apply flex items-center justify-center;

  &__avatar {
    @apply w-1em h-1em rounded-full;
    @apply bg-primary-1 dark-bg-primary-5;
  }
}
</style>
