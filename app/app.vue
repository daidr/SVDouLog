<script setup lang="ts">
import type { Directions, LocaleObject } from '@nuxtjs/i18n'
import { CONFIG } from '~~/config/base'
import { useDouSlackingStore } from './stores/dou-slacking'
import { THEME_COLOR_COUNT } from './stores/states'
import { SPLASH_IMAGES } from './utils/splash-images'

const { randomThemeColorIndex, themeColor } = storeToRefs(useStatesStore())
const colorMode = useColorMode()

const { locale, locales, t } = useI18n()

// 站点 metadata（server-state 注水）：SEO 标题/描述/关键词优先取它，i18n / CONFIG 兜底。
// 在 app 根组件调用即触发 SSR 拉取，供首页 / 社交栏等共享同一份数据。
const siteMetadata = useSiteMetadata()

useSiteSeoDefaults()

const localeMap = (locales.value as LocaleObject[]).reduce((acc, l) => {
  acc[l.code!] = l.dir ?? 'ltr'
  return acc
}, {} as Record<string, Directions>)

function unescapeTitleTemplate(titleTemplate: string, replacements: [string, string[]][]) {
  let result = titleTemplate
  for (const [replacement, entities] of replacements) {
    for (const e of entities) {
      result = result.replaceAll(e, replacement)
    }
  }
  return result.trim()
}

useHydratedHead({
  meta: [
    () => ({
      name: 'theme-color',
      content: themeColor.value,
    }),
  ],
  link: [
    () => import.meta.client
      ? {
          key: 'webmanifest',
          rel: 'manifest',
          href: `/manifest-${locale.value}${colorMode.value === 'dark' ? '-dark' : ''}.webmanifest`,
        }
      : {},
  ],
  htmlAttrs: {
    class: () => {
      return {
        dark: colorMode.value === 'dark',
      }
    },
  },
})

useHead({
  // 语言由服务端定好，lang / dir 随 SSR 一起输出
  htmlAttrs: {
    lang: () => locale.value,
    dir: () => localeMap[locale.value] ?? 'ltr',
  },
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'RSS',
      href: '/feed.xml',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      href: '/favicon-16x16.png',
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/pwa/apple-touch-icon.png',
    },
    {
      rel: 'mask-icon',
      href: '/pwa/safari-pinned-tab.svg',
      color: '#5d5bd5',
    },
    {
      rel: 'dns-prefetch',
      href: 'https://cdn.daidr.me',
    },
    {
      rel: 'dns-prefetch',
      href: 'https://i.loli.net',
    },
    {
      rel: 'preconnect',
      href: 'https://cdn.daidr.me',
    },
    {
      rel: 'preconnect',
      href: 'https://i.loli.net',
    },
    ...SPLASH_IMAGES,
  ],
  script: [
    // body 在带上主题色 class 之前是透明的（global.scss），主题色每次访问随机、只能在浏览器里选。
    // 在 <body> 开头用内联脚本选好，首帧就带着主题色显示，不用等应用加载完；首帧就有的 class
    // 不会触发 opacity 过渡。store 读 window.__svThemeIndex 沿用这次的选择
    {
      key: 'theme-init',
      tagPosition: 'bodyOpen',
      innerHTML: `(function(){var i=Math.floor(Math.random()*${THEME_COLOR_COUNT});window.__svThemeIndex=i;document.body.classList.add('theme-'+(i+1))})()`,
    },
  ],
  titleTemplate: (title?: string) => {
    let titleTemplate = title ?? ''

    if (/&[a-z0-9#]+;/i.test(titleTemplate)) {
      titleTemplate = unescapeTitleTemplate(titleTemplate, [
        ['"', ['&#34;', '&quot;']],
        ['&', ['&#38;', '&amp;']],
        ['\'', ['&#39;', '&apos;']],
        ['\u003C', ['&#60;', '&lt;']],
        ['\u003E', ['&#62;', '&gt;']],
      ])
      if (titleTemplate.length > 60) {
        titleTemplate = `${titleTemplate.slice(0, 60)}...${titleTemplate.endsWith('"') ? '"' : ''}`
      }

      if (!titleTemplate.includes('"')) {
        titleTemplate = `"${titleTemplate}"`
      }
    } else if (titleTemplate.length > 60) {
      titleTemplate = `${titleTemplate.slice(0, 60)}...${titleTemplate.endsWith('"') ? '"' : ''}`
    }

    const site_name = siteMetadata.value?.site?.title || t('global.site_name')

    // 首页这类不设标题的页面直接用站点名
    if (!titleTemplate.length) {
      return site_name
    }

    if (site_name.length) {
      titleTemplate += ' | '
      titleTemplate += site_name
    }

    return titleTemplate
  },
  meta: computed(() => [
    {
      hid: 'keywords',
      name: 'keywords',
      content: siteMetadata.value?.site?.keywords?.length
        ? siteMetadata.value.site.keywords.join(',')
        : CONFIG.keywords.join(','),
    },
    {
      name: 'viewport',
      content:
        'width=device-width, initial-scale=1.0, viewport-fit=cover, minimum-scale=1, maximum-scale=1.0, user-scalable=0',
    },
    {
      name: 'apple-mobile-web-app-capable',
      content: 'yes',
    },
    {
      name: 'mobile-web-app-capable',
      content: 'yes',
    },
    {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'black-translucent',
    },
  ]),
})

watch(() => randomThemeColorIndex.value, (index, oldIndex) => {
  if (import.meta.env.SSR) return
  if (oldIndex !== undefined) {
    document.body.classList.remove(`theme-${oldIndex + 1}`)
  }

  document.body.classList.add(`theme-${index + 1}`)
}, {
  immediate: true,
})

const routerTransition = ref()
const pageTransition = {
  css: false,
  onBeforeLeave: (el) => {
    routerTransition.value?.onBeforeLeave(el)
  },
  onLeave: (el, done) => {
    if (routerTransition.value) {
      routerTransition.value.onLeave(el, done)
    } else {
      done()
    }
  },
  onAfterLeave: (el) => {
    routerTransition.value?.onAfterLeave(el)
  },
  onBeforeEnter: (el) => {
    routerTransition.value?.onBeforeEnter(el)
  },
  onEnter: (el, done) => {
    if (routerTransition.value) {
      routerTransition.value.onEnter(el, done)
    } else {
      done()
    }
  },
  onAfterEnter: (el) => {
    routerTransition.value?.onAfterEnter(el)
  },
}

onMounted(() => {
  useDouSlackingStore()
})
</script>

<template>
  <CommonWappalyzerCheat />
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
    <CommonRouterTransition ref="routerTransition" />
  </NuxtLayout>
</template>
