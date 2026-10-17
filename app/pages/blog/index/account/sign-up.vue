<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.sign_up')) })

const route = useRoute()
const redirect = useAccountRedirect()
const { refresh } = useReaderAccount()

const name = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const done = ref(false)

async function onSubmit() {
  errorMsg.value = ''
  if (password.value.length < 8) {
    errorMsg.value = t('account.errors.password_too_short')
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        // 验证邮件里的链接点开后回到这里
        callbackURL: absoluteUrl('/blog/account/verify-email'),
      },
    })
    // 注册即登录；验证邮箱不是评论的前提
    await refresh()
    done.value = true
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
  } finally {
    submitting.value = false
  }
}
</script>

<script lang="ts">
export default {
  name: 'AccountSignUp',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.sign_up')">
    <div v-if="done" class="auth-body">
      <p class="auth-notice">
        {{ t('account.sign_up_done', { email }) }}
      </p>
      <NuxtLink class="auth-btn" :to="redirect">
        {{ t('account.continue') }}
      </NuxtLink>
    </div>
    <form v-else @submit.prevent="onSubmit">
      <input
        v-model="name"
        class="auth-input"
        type="text"
        name="name"
        autocomplete="nickname"
        required
        maxlength="32"
        :placeholder="t('account.field.name')"
        :aria-label="t('account.field.name')"
        :disabled="submitting"
      >
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
        autocomplete="new-password"
        required
        minlength="8"
        maxlength="128"
        :placeholder="t('account.field.new_password')"
        :aria-label="t('account.field.new_password')"
        :disabled="submitting"
      >
      <p v-if="errorMsg" class="auth-error" role="alert">
        {{ errorMsg }}
      </p>
      <button class="auth-btn" type="submit" :disabled="submitting">
        <IconLoading v-if="submitting" class="animate-spin" />
        {{ t('account.sign_up') }}
      </button>
      <div class="auth-links">
        <NuxtLink :to="{ path: '/blog/account/sign-in', query: route.query.redirect ? { redirect } : {} }">
          {{ t('account.go_sign_in') }}
        </NuxtLink>
      </div>
    </form>
  </SiteAuthPanel>
</template>
