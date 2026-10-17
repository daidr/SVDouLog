export default defineNuxtPlugin((nuxt) => {
  // 文案（$t）服务端和浏览器用同一个语言渲染（语言在服务端按 cookie / Accept-Language 定好），
  // 直接输出。日期、数字的格式化依赖运行环境的时区，hydrate 前留空，避免两端对不上
  const d = nuxt.vueApp.config.globalProperties.$d
  const n = nuxt.vueApp.config.globalProperties.$n
  nuxt.vueApp.config.globalProperties.$d = wrapI18n(d)
  nuxt.vueApp.config.globalProperties.$n = wrapI18n(n)

  if (import.meta.client) {
    const i18n = useNuxtApp().$i18n
    const { setLocale, locales } = i18n
    const localSettings = useLocalSettings()
    const lang = computed(() => localSettings.value.language)

    const supportLanguages = unref(locales).map(locale => locale.code)
    if (!supportLanguages.includes(lang.value)) {
      localSettings.value.language = i18n.locale.value
    }

    // 本地设置里的语言和服务端选的不同（老访客只在 localStorage 里存过偏好，或在设置里改了语言）：
    // hydrate 之后再切，切换时 i18n 会写 cookie，之后服务端就按它渲染
    watch([lang, isHydrated], () => {
      if (isHydrated.value && lang.value !== i18n.locale.value) {
        setLocale(lang.value)
      }
    }, { immediate: true })
  }
})
