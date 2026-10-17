<script setup lang="ts">
/**
 * Cloudflare Turnstile 人机验证。Site Key 来自 story-verse 的公开 metadata；
 * 拿到的 token 随评论请求体经 BFF 转给 story-verse 校验（浏览器只和
 * Cloudflare 的验证脚本打交道，不直连 story-verse）。
 *
 * 用 interaction-only：大多数读者看不到组件，只有 Cloudflare 需要读者点一下
 * 时才显示。token 只能用一次，提交后父组件调 reset() 换新的。
 */
const props = defineProps<{ siteKey: string }>()
const token = defineModel<string>({ default: '' })

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi }
  if (w.turnstile) return Promise.resolve(w.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('turnstile load failed'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

const colorMode = useColorMode()
const container = ref<HTMLElement | null>(null)
let api: TurnstileApi | null = null
let widgetId: string | null = null

onMounted(async () => {
  try {
    api = await loadTurnstile()
  } catch {
    return
  }
  if (!container.value) return
  widgetId = api.render(container.value, {
    'sitekey': props.siteKey,
    'action': 'comment',
    'appearance': 'interaction-only',
    'size': 'flexible',
    'theme': colorMode.value === 'dark' ? 'dark' : 'light',
    'callback': (value: string) => {
      token.value = value
    },
    'expired-callback': () => {
      token.value = ''
    },
    'error-callback': () => {
      token.value = ''
    },
  })
})

onBeforeUnmount(() => {
  if (api && widgetId) api.remove(widgetId)
})

function reset() {
  token.value = ''
  if (api && widgetId) api.reset(widgetId)
}

defineExpose({ reset })
</script>

<template>
  <div ref="container" class="comment-turnstile" />
</template>

<style lang="scss" scoped>
// 组件在不需要读者操作时是隐藏的；contents 让容器本身不占位，
// 免得在父级 flex 里多出一道空白间距
.comment-turnstile {
  display: contents;
}
</style>
