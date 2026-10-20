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
    const res = await $fetch<{ twoFactorRedirect?: boolean }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email: email.value.trim(), password: password.value },
    })
    // 开了两步验证：密码只换到一张挑战凭证（cookie），会话要等验证码通过才发
    if (res?.twoFactorRedirect) {
      password.value = ''
      code.value = ''
      useBackupCode.value = false
      step.value = 'two-factor'
      return
    }
    await refresh()
    await navigateTo(redirect.value)
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
  } finally {
    submitting.value = false
  }
}

const step = ref<'password' | 'two-factor'>('password')
const code = ref('')
const useBackupCode = ref(false)
const trustDevice = ref(false)

const normalizedCode = computed(() => useBackupCode.value ? code.value.trim() : code.value.replace(/\D/g, ''))
const codeReady = computed(() => useBackupCode.value ? normalizedCode.value.length > 0 : normalizedCode.value.length === 6)

watch(code, (value) => {
  if (useBackupCode.value) return
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits !== value) code.value = digits
  else if (digits.length === 6) onVerify()
})

function toggleBackupCode() {
  useBackupCode.value = !useBackupCode.value
  code.value = ''
  errorMsg.value = ''
}

function backToPassword() {
  step.value = 'password'
  code.value = ''
  errorMsg.value = ''
}

async function onVerify() {
  if (!codeReady.value || submitting.value) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await $fetch(useBackupCode.value ? '/api/auth/two-factor/verify-backup-code' : '/api/auth/two-factor/verify-totp', {
      method: 'POST',
      body: { code: normalizedCode.value, trustDevice: trustDevice.value },
    })
    await refresh()
    await navigateTo(redirect.value)
  } catch (err) {
    code.value = ''
    errorMsg.value = authErrorMessage(err, t)
    // 挑战凭证过期或错太多次，只能重新输密码
    const errCode = (err as { data?: { code?: string } })?.data?.code
    if (errCode === 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE' || errCode === 'INVALID_TWO_FACTOR_COOKIE') {
      step.value = 'password'
    }
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
    <form v-if="step === 'two-factor'" @submit.prevent="onVerify">
      <input
        v-if="useBackupCode"
        v-model="code"
        class="auth-input"
        type="text"
        name="backup-code"
        autocomplete="off"
        required
        maxlength="32"
        autofocus
        :placeholder="t('account.two_factor.backup_code')"
        :aria-label="t('account.two_factor.backup_code')"
        :disabled="submitting"
      >
      <input
        v-else
        v-model="code"
        class="auth-input"
        type="text"
        name="one-time-code"
        inputmode="numeric"
        autocomplete="one-time-code"
        required
        maxlength="6"
        autofocus
        :placeholder="t('account.two_factor.code')"
        :aria-label="t('account.two_factor.code')"
        :disabled="submitting"
      >
      <label class="auth-check">
        <input v-model="trustDevice" type="checkbox" :disabled="submitting">
        {{ t('account.two_factor.trust_device') }}
      </label>
      <p v-if="errorMsg" class="auth-error" role="alert">
        {{ errorMsg }}
      </p>
      <button class="auth-btn" type="submit" :disabled="submitting || !codeReady">
        <IconLoading v-if="submitting" class="animate-spin" />
        {{ t('account.two_factor.verify') }}
      </button>
      <div class="auth-links">
        <button type="button" :disabled="submitting" @click="backToPassword">
          {{ t('account.two_factor.back') }}
        </button>
        <button type="button" :disabled="submitting" @click="toggleBackupCode">
          {{ useBackupCode ? t('account.two_factor.use_app') : t('account.two_factor.use_backup') }}
        </button>
      </div>
    </form>
    <form v-else @submit.prevent="onSubmit">
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
