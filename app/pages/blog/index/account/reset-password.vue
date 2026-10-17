<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.reset_title')) })

// 邮件链接经 /api/auth/reset-password/:token 校验后跳来，带 ?token= 或 ?error=INVALID_TOKEN
const route = useRoute()
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')
const invalid = computed(() => !token.value || !!route.query.error)

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
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, newPassword: password.value },
    })
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
  name: 'AccountResetPassword',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.reset_title')">
    <div v-if="done || invalid" class="auth-body">
      <p class="auth-notice">
        {{ done ? t('account.reset_done') : t('account.errors.link_invalid') }}
      </p>
      <NuxtLink v-if="done" class="auth-btn" to="/blog/account/sign-in">
        {{ t('account.sign_in') }}
      </NuxtLink>
      <NuxtLink v-else class="auth-btn auth-btn--ghost" to="/blog/account/forgot-password">
        {{ t('account.send_reset_again') }}
      </NuxtLink>
    </div>
    <form v-else @submit.prevent="onSubmit">
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
        {{ t('account.reset_submit') }}
      </button>
    </form>
  </SiteAuthPanel>
</template>
