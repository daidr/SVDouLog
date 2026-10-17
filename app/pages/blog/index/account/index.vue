<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.title')) })

const { account, refresh, signOut } = useReaderAccount()
onMounted(refresh)

watch(account, (value) => {
  if (value === null) navigateTo({ path: '/blog/account/sign-in', query: { redirect: '/blog/account' } }, { replace: true })
}, { immediate: true })

const avatarUrl = computed(() => account.value?.image || `https://cravatar.cn/avatar/${account.value?.emailHash}?d=mp&s=128`)

const busy = ref(false)
const verificationSent = ref(false)
const errorMsg = ref('')

async function resendVerification() {
  if (!account.value) return
  errorMsg.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/send-verification-email', {
      method: 'POST',
      body: { email: account.value.email, callbackURL: absoluteUrl('/blog/account/verify-email') },
    })
    verificationSent.value = true
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
  } finally {
    busy.value = false
  }
}

async function onSignOut() {
  busy.value = true
  try {
    await signOut()
    await navigateTo('/blog')
  } finally {
    busy.value = false
  }
}
</script>

<script lang="ts">
export default {
  name: 'AccountIndex',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.title')">
    <div v-if="!account" class="auth-body items-start">
      <UiLoadingIcon />
    </div>
    <div v-else class="auth-body">
      <div class="account-card">
        <img class="account-card__avatar" :src="avatarUrl" alt="" width="56" height="56">
        <div class="account-card__info">
          <div class="account-card__name">
            {{ account.name }}
          </div>
          <div class="account-card__email">
            {{ account.email }}
          </div>
        </div>
      </div>
      <template v-if="!account.emailVerified">
        <p class="auth-notice">
          {{ verificationSent ? t('account.verification_sent', { email: account.email }) : t('account.email_unverified') }}
        </p>
        <button v-if="!verificationSent" class="auth-btn auth-btn--ghost" type="button" :disabled="busy" @click="resendVerification">
          {{ t('account.resend_verification') }}
        </button>
      </template>
      <p v-if="errorMsg" class="auth-error" role="alert">
        {{ errorMsg }}
      </p>
      <button class="auth-btn" type="button" :disabled="busy" @click="onSignOut">
        <IconLoading v-if="busy" class="animate-spin" />
        {{ t('account.sign_out') }}
      </button>
    </div>
  </SiteAuthPanel>
</template>

<style lang="scss" scoped>
.account-card {
  @apply flex items-center gap-4 mb-2;

  &__avatar {
    @apply w-14 h-14 rounded-full flex-shrink-0;
    @apply bg-primary-1 dark-bg-primary-5;
  }

  &__info {
    @apply flex flex-col min-w-0;
  }

  &__name {
    @apply text-lg font-bold text-primary dark-text-primary-8 truncate;
  }

  &__email {
    @apply text-base text-primary-text;
    overflow-wrap: anywhere;
  }
}
</style>
