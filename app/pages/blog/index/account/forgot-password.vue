<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'

definePageMeta({
  isInArticlePage: false,
})

const { t } = useI18n()
useHead({ title: computed(() => t('account.forgot_title')) })

const email = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const sent = ref(false)

async function onSubmit() {
  errorMsg.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/request-password-reset', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        redirectTo: absoluteUrl('/blog/account/reset-password'),
      },
    })
    sent.value = true
  } catch (err) {
    errorMsg.value = authErrorMessage(err, t)
  } finally {
    submitting.value = false
  }
}
</script>

<script lang="ts">
export default {
  name: 'AccountForgotPassword',
}
</script>

<template>
  <SiteAuthPanel :title="t('account.forgot_title')">
    <div v-if="sent" class="auth-body">
      <p class="auth-notice">
        {{ t('account.reset_sent', { email }) }}
      </p>
      <NuxtLink class="auth-btn auth-btn--ghost" to="/blog/account/sign-in">
        {{ t('account.go_sign_in') }}
      </NuxtLink>
    </div>
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
      <p v-if="errorMsg" class="auth-error" role="alert">
        {{ errorMsg }}
      </p>
      <button class="auth-btn" type="submit" :disabled="submitting">
        <IconLoading v-if="submitting" class="animate-spin" />
        {{ t('account.send_reset') }}
      </button>
      <div class="auth-links">
        <NuxtLink to="/blog/account/sign-in">
          {{ t('account.go_sign_in') }}
        </NuxtLink>
      </div>
    </form>
  </SiteAuthPanel>
</template>
