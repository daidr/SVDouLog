<script setup lang="ts">
import IconGithub from '~icons/mingcute/github-line'
import IconLoading from '~icons/mingcute/loading-3-line'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.sign_in')) })

const route = useRoute()
const redirect = useAccountRedirect()
const metadata = useSiteMetadata()
const githubEnabled = computed(() => metadata.value?.auth?.socialProviders.includes('github') ?? false)
const { refresh } = useReaderAccount()

const email = ref('')
const password = ref('')
const submitting = ref(false)
// GitHub 登录失败会带着 ?error= 跳回本页
const errorMsg = ref(route.query.error ? t('account.errors.social_failed') : '')

async function onSubmit() {
  errorMsg.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email: email.value.trim(), password: password.value },
    })
    await refresh()
    await navigateTo(redirect.value)
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
  } finally {
    submitting.value = false
  }
}

async function signInWithGithub() {
  errorMsg.value = ''
  submitting.value = true
  try {
    const res = await $fetch<{ url: string }>('/api/auth/sign-in/social', {
      method: 'POST',
      body: {
        provider: 'github',
        callbackURL: absoluteUrl(redirect.value),
        errorCallbackURL: absoluteUrl('/blog/account/sign-in'),
      },
    })
    window.location.href = res.url
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
    submitting.value = false
  }
}
</script>

<script lang="ts">
export default {
  name: 'AccountSignIn',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.sign_in')">
    <form @submit.prevent="onSubmit">
      <input
        v-model="email"
        class="auth-input"
        type="email"
        name="email"
        autocomplete="email"
        required
        maxlength="254"
        :placeholder="t('account.field.email')"
        :aria-label="t('account.field.email')"
        :disabled="submitting"
      >
      <input
        v-model="password"
        class="auth-input"
        type="password"
        name="password"
        autocomplete="current-password"
        required
        :placeholder="t('account.field.password')"
        :aria-label="t('account.field.password')"
        :disabled="submitting"
      >
      <p v-if="errorMsg" class="auth-error" role="alert">
        {{ errorMsg }}
      </p>
      <button class="auth-btn" type="submit" :disabled="submitting">
        <IconLoading v-if="submitting" class="animate-spin" />
        {{ t('account.sign_in') }}
      </button>
      <template v-if="githubEnabled">
        <div class="auth-divider">
          {{ t('account.or') }}
        </div>
        <button class="auth-btn auth-btn--ghost" type="button" :disabled="submitting" @click="signInWithGithub">
          <IconGithub />
          {{ t('account.github') }}
        </button>
      </template>
      <div class="auth-links">
        <NuxtLink :to="{ path: '/blog/account/sign-up', query: route.query.redirect ? { redirect } : {} }">
          {{ t('account.go_sign_up') }}
        </NuxtLink>
        <NuxtLink to="/blog/account/forgot-password">
          {{ t('account.forgot_password') }}
        </NuxtLink>
      </div>
    </form>
  </SiteAuthPanel>
</template>
