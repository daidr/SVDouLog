<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'
import IconLock from '~icons/mingcute/lock-line'

/**
 * 设了访问密码的文章：读者输对密码后，本站服务端把解锁 token 放进 httpOnly cookie
 * （见 server/api/post/[id]/unlock.post.ts），这里只负责提交密码、通知页面重新取正文。
 */
const props = defineProps<{
  postId: number
}>()

const emit = defineEmits<{
  unlocked: []
}>()

const { t } = useI18n()

const password = ref('')
const busy = ref(false)
const errorMsg = ref('')

function errorMessage(err: any): string {
  if (err?.data?.key === 'error.password_incorrect') return t('post_password.errors.incorrect')
  if (err?.statusCode === 429 || err?.status === 429) return t('post_password.errors.too_many_requests')
  return t('post_password.errors.failed')
}

async function submit() {
  if (!password.value || busy.value) return
  errorMsg.value = ''
  busy.value = true
  try {
    await $fetch(`/api/post/${props.postId}/unlock`, {
      method: 'POST',
      body: { password: password.value },
    })
    password.value = ''
    emit('unlocked')
  } catch (err) {
    errorMsg.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="post-password">
    <p class="post-password__text">
      <IconLock class="post-password__icon" />
      {{ t('post_password.prompt') }}
    </p>
    <form class="post-password__row" @submit.prevent="submit">
      <input
        v-model="password"
        type="password"
        class="post-password__input"
        :placeholder="t('post_password.placeholder')"
        :aria-label="t('post_password.placeholder')"
        maxlength="128"
        autocomplete="off"
        :disabled="busy"
      >
      <button type="submit" class="post-password__btn" :disabled="busy || !password">
        <IconLoading v-if="busy" class="animate-spin" />
        {{ t('post_password.submit') }}
      </button>
    </form>
    <p v-if="errorMsg" class="post-password__error" role="alert">
      {{ errorMsg }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.post-password {
  @apply flex flex-col gap-3 py-6;
}

.post-password__text {
  @apply flex items-center gap-2 text-base text-primary-text;
}

.post-password__icon {
  @apply flex-shrink-0 text-primary dark-text-primary-7;
}

.post-password__row {
  @apply flex flex-wrap items-stretch gap-2;
}

.post-password__input {
  @apply flex-1 min-w-0 px-3 py-2 rounded-xl;
  @apply bg-light dark-bg-dark/60;
  @apply border border-primary-2/60 dark-border-primary-4/60;
  @apply text-dark dark-text-light;
  @apply transition-colors;
  flex-basis: 12rem;

  &:focus {
    @apply outline-none;
    @apply border-primary dark-border-primary-7;
  }
}

.post-password__btn {
  @apply inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl flex-shrink-0;
  @apply text-sm font-medium whitespace-nowrap;
  @apply bg-primary text-light dark-bg-primary-7;
  @apply hover:bg-primary-7 dark-hover-bg-primary-8;
  @apply transition-colors;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
}

.post-password__error {
  @apply text-sm text-red-600 dark-text-red-400;
}
</style>
