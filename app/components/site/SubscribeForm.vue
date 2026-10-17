<script setup lang="ts">
import IconLoading from '~icons/mingcute/loading-3-line'

/**
 * 新文章邮件订阅。story-verse 后台开放订阅时才显示（metadata.subscriptions.enabled）。
 *
 *   - 游客：填邮箱提交，story-verse 发确认邮件，点邮件里的链接才生效
 *   - 已登录：用账号邮箱一键订阅 / 退订（邮箱已验证的直接生效）
 *
 * 所有请求走本站 BFF（/api/subscriptions/*）。登录态只在浏览器里取，父级用 ClientOnly 包住。
 */
type Status = 'none' | 'pending' | 'active' | 'unsubscribed'
interface MeResponse {
  status: Status
  email: string
}

const { t } = useI18n()
const metadata = useSiteMetadata()
const enabled = computed(() => metadata.value?.subscriptions?.enabled === true)
const turnstileSiteKey = computed(() => metadata.value?.comments?.turnstileSiteKey ?? null)

const { account } = useReaderAccount()

const email = ref('')
// 蜜罐：表单上不展示，机器人按 name 自动填充就会触发
const honeypot = ref('')
const turnstileToken = ref('')
const turnstile = ref<{ reset: () => void } | null>(null)

const busy = ref(false)
const errorMsg = ref('')
/** 游客提交成功后显示「去邮箱确认」 */
const sentTo = ref('')
/** 登录读者的订阅状态；null = 还没取到 */
const me = ref<MeResponse | null>(null)

watch([enabled, account], async ([on, value]) => {
  me.value = null
  if (!on || !value) return
  try {
    me.value = await $fetch<MeResponse>('/api/subscriptions/me')
  } catch {
    me.value = { status: 'none', email: value.email }
  }
}, { immediate: true })

function errorMessage(err: any): string {
  if (err?.data?.key === 'error.captcha_failed') return t('subscribe.errors.captcha_failed')
  if (err?.statusCode === 429 || err?.status === 429) return t('subscribe.errors.too_many_requests')
  return err?.data?.msg || err?.data?.message || t('subscribe.errors.failed')
}

async function submitEmail() {
  errorMsg.value = ''
  const value = email.value.trim()
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value)) {
    errorMsg.value = t('subscribe.errors.email_invalid')
    return
  }
  if (turnstileSiteKey.value && !turnstileToken.value) {
    errorMsg.value = t('subscribe.errors.captcha_pending')
    return
  }
  busy.value = true
  try {
    await $fetch('/api/subscriptions', {
      method: 'POST',
      body: {
        email: value,
        turnstileToken: turnstileSiteKey.value ? turnstileToken.value : undefined,
        website_url: honeypot.value || undefined,
      },
    })
    sentTo.value = value
    email.value = ''
  } catch (err) {
    errorMsg.value = errorMessage(err)
  } finally {
    busy.value = false
    turnstile.value?.reset()
  }
}

async function toggleAccount() {
  if (!me.value) return
  errorMsg.value = ''
  busy.value = true
  try {
    me.value = await $fetch<MeResponse>('/api/subscriptions/me', {
      method: me.value.status === 'active' ? 'DELETE' : 'PUT',
    })
  } catch (err) {
    errorMsg.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="enabled" class="subscribe">
    <h3 class="subscribe__title">
      {{ t('subscribe.title') }}
    </h3>

    <template v-if="account">
      <div v-if="me" class="subscribe__row">
        <p class="subscribe__text">
          <template v-if="me.status === 'active'">
            {{ t('subscribe.account_active', { email: me.email }) }}
          </template>
          <template v-else-if="me.status === 'pending'">
            {{ t('subscribe.check_inbox', { email: me.email }) }}
          </template>
          <template v-else>
            {{ t('subscribe.account_prompt', { email: me.email }) }}
          </template>
        </p>
        <button
          type="button"
          class="subscribe__btn"
          :class="{ 'subscribe__btn--ghost': me.status === 'active' }"
          :disabled="busy"
          @click="toggleAccount"
        >
          <IconLoading v-if="busy" class="animate-spin" />
          {{ me.status === 'active' ? t('subscribe.unsubscribe') : t('subscribe.submit') }}
        </button>
      </div>
    </template>

    <p v-else-if="sentTo" class="subscribe__text" role="status">
      {{ t('subscribe.check_inbox', { email: sentTo }) }}
    </p>

    <form v-else class="subscribe__row subscribe__row--form" @submit.prevent="submitEmail">
      <input
        v-model="email"
        type="email"
        class="subscribe__input"
        :placeholder="t('subscribe.email_placeholder')"
        :aria-label="t('subscribe.email_placeholder')"
        maxlength="254"
        autocomplete="email"
        :disabled="busy"
      >
      <div class="subscribe__honeypot" aria-hidden="true">
        <label>
          Website
          <input v-model="honeypot" type="text" name="website_url" tabindex="-1" autocomplete="off">
        </label>
      </div>
      <button type="submit" class="subscribe__btn" :disabled="busy">
        <IconLoading v-if="busy" class="animate-spin" />
        {{ busy ? t('subscribe.submitting') : t('subscribe.submit') }}
      </button>
      <SiteCommentTurnstile
        v-if="turnstileSiteKey"
        ref="turnstile"
        v-model="turnstileToken"
        :site-key="turnstileSiteKey"
        action="subscribe"
      />
    </form>

    <p v-if="errorMsg" class="subscribe__error" role="alert">
      {{ errorMsg }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.subscribe {
  @apply flex flex-col gap-3;
}

.subscribe__title {
  @apply text-xl font-bold text-primary dark-text-primary-7;
}

.subscribe__row {
  @apply flex flex-wrap items-center gap-2;

  // 输入框和按钮等高
  &--form {
    @apply items-stretch;
  }
}

.subscribe__text {
  @apply flex-1 min-w-0 text-base text-primary-text;
  overflow-wrap: anywhere;
}

.subscribe__input {
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

.subscribe__honeypot {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.subscribe__btn {
  @apply inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl flex-shrink-0;
  @apply text-sm font-medium whitespace-nowrap;
  @apply bg-primary text-light dark-bg-primary-7;
  @apply hover:bg-primary-7 dark-hover-bg-primary-8;
  @apply transition-colors;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;

  &--ghost {
    @apply bg-transparent text-primary-text dark-bg-transparent dark-text-primary-7;
    @apply border border-primary-2/60 dark-border-primary-4/60;
    @apply hover:bg-primary-2/40 dark-hover-bg-primary-4/40;
  }
}

.subscribe__error {
  @apply text-sm text-red-600 dark-text-red-400;
}
</style>
