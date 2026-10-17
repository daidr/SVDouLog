export type ColorMode = 'light' | 'dark' | 'system'

export interface LocalSettings {
  language: string
  colorMode?: ColorMode
}

export function useLocalSettings() {
  const { locale } = useNuxtApp().$i18n
  // 没存过设置时沿用服务端按 cookie / Accept-Language 选好的语言
  const settingsStorage = useLocalStorage<LocalSettings>('doulog-local-settings', () => ({ language: locale.value }))

  return settingsStorage
}
