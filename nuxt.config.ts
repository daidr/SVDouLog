import type { BuildInfo } from './types'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import Icons from 'unplugin-icons/vite'
import { currentLocales } from './config/i18n'

// Patch unplugin-icons so the resolved virtual id keeps a leading slash.
// Without it, Vite 7's import-analysis fails to resolve `vue` from the
// virtual icon module (it tries to resolve relative to a non-existent
// importer path). With a leading slash Vite treats it as root-relative
// and resolution works.
function IconsWithLeadingSlash() {
  const plugin = Icons({ compiler: 'vue3' }) as any
  const wrap = (target: any) => {
    if (!target) return
    const origResolveId = target.resolveId
    if (origResolveId) {
      target.resolveId = async function (...args: any[]) {
        const r = await origResolveId.apply(this, args)
        if (typeof r === 'string' && !r.startsWith('/') && !r.startsWith('\0')) {
          return `/${r}`
        }
        return r
      }
    }
  }
  if (Array.isArray(plugin)) {
    plugin.forEach(wrap)
  } else {
    wrap(plugin)
  }
  return plugin
}

export default defineNuxtConfig({
  compatibilityDate: '2026-05-10',
  typescript: {
    shim: false,
  },
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },
  app: {
    rootId: '__daidr_app',
    buildAssetsDir: '/_doulog/',
  },
  appConfig: {
    umami: {
      host:
        process.env.NUXT_PUBLIC_UMAMI_HOST || 'https://analytics.eu.umami.is',
      id: process.env.NUXT_PUBLIC_UMAMI_ID || '',
      version: 2,
      domains: ['im.daidr.me'],
      ignoreLocalhost: true,
    },
  },
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    'nuxt-umami',
    // motion-v 提供 <Motion> 组件 + spring/keyframe 过渡，文章正文里的轮播
    // 用它做切换动画。注册为 nuxt 模块即自动注入 <Motion> 等组件全局可用，
    // 无需手动 import。
    'motion-v/nuxt',
    './modules/pwa/index',
    './modules/purge-comments',
  ],
  colorMode: {
    classSuffix: '',
  },
  routeRules: {
    '/manifest.webmanifest': {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    },
  },
  i18n: {
    locales: currentLocales,
    lazy: true,
    strategy: 'no_prefix',
    // 语言在服务端确定：有 cookie 用 cookie（用户选过的语言），没有就按 Accept-Language。
    // 服务端直接输出对应语言的文字，页面不必等前端加载完再换语言
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'doulog_lang',
      redirectOn: 'root',
      fallbackLocale: 'en-US',
    },
    langDir: 'locales',
    defaultLocale: 'en-US',
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://im.daidr.me',
    vueI18n: '../config/i18n.config.ts',
  },
  imports: {
    imports: [{
      name: 'useI18n',
      from: '~/utils/i18n',
      priority: 100,
    }],
    injectAtEnd: true,
  },
  pwa: {
    scope: '/',
    srcDir: resolve(fileURLToPath(new URL('.', import.meta.url)), 'service-worker'),
    filename: 'sw.ts',
    strategies: 'injectManifest',
    injectRegister: false,
    includeManifestIcons: false,
    manifest: false,
    injectManifest: {
      globPatterns: ['**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}'],
      globIgnores: ['manifest**.webmanifest'],
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
  css: [
    '@unocss/reset/tailwind.css',
    '~/assets/scss/global.scss',
    '~/assets/fonts/BEYNO/font.css',
  ],
  runtimeConfig: {
    // story-verse 后端 base URL（仅服务端；可以是内网地址）。本地默认指向 packages/core
    // 的开发端口 (SV_APP_PORT=3005 in packages/core/.env)；线上由 NUXT_BLOG_API_ENTRY 覆盖。
    apiEntry: process.env.NUXT_BLOG_API_ENTRY || 'http://localhost:3005',
    // 与 story-verse 的 SV_FRONTEND_TOKEN 相同：代读者调用时凭它声明读者 IP
    svFrontendToken: process.env.NUXT_SV_FRONTEND_TOKEN || '',
    // 本站前面的反代 / 平台写入读者 IP 的头（如 x-real-ip）。留空 = 用 socket 对端地址
    clientIpHeader: process.env.NUXT_CLIENT_IP_HEADER || '',
    GithubAPIEntry:
      process.env.NUXT_GITHUB_API_ENTRY || 'https://api.github.com',
    // /api/clean_cache 的 Bearer token（仅服务端）。留空 = 接口关闭
    cachePurgeToken: process.env.NUXT_CACHE_PURGE_TOKEN || '',
    // story-verse 内容变更 webhook 的签名密钥（与后台「前端站点通知」里的密钥一致）。
    // 配置后 /api/sv-webhook 生效，回源缓存改为长 TTL + 变更时精准失效
    svWebhookSecret: process.env.NUXT_SV_WEBHOOK_SECRET || '',
    app: {
      buildAssetsDir: '/_doulog/',
    },
    public: {
      // 站点对外地址，RSS / sitemap / 分享卡片里的绝对链接以此为前缀
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://im.daidr.me',
      // 文章分享图的版式散列，构建时由 modules/share-card.ts 填入
      shareCardRevision: '',
      // 注意：这里不放 story-verse 的地址。浏览器只访问本站，所有后端调用都经
      // server/ 下的接口转发（见 server/utils/sv-client.ts）。
    },
  },
  nitro: {
    storage: {
      redis: {
        driver: 'redis',
        port: process.env.NUXT_BLOG_REDIS_PORT || 6379,
        host: process.env.NUXT_BLOG_REDIS_HOST || '127.0.0.1',
        username: process.env.NUXT_BLOG_REDIS_USER || '',
        password: process.env.NUXT_BLOG_REDIS_PASSWORD || '',
        db: process.env.NUXT_BLOG_REDIS_DB || 0,
        tls: {},
      },
      cache: {
        driver: 'redis',
        port: process.env.NUXT_BLOG_REDIS_PORT || 6379,
        host: process.env.NUXT_BLOG_REDIS_HOST || '127.0.0.1',
        username: process.env.NUXT_BLOG_REDIS_USER || '',
        password: process.env.NUXT_BLOG_REDIS_PASSWORD || '',
        db: process.env.NUXT_BLOG_REDIS_DB || 0,
        tls: {},
      },
    },
    devStorage: {
      cache: {
        driver: 'memory',
      },
    },
  },
  hooks: {
    'vite:extendConfig': (config) => {
      config.plugins ||= []
      config.plugins.push(IconsWithLeadingSlash())
    },
  },
  vite: {
    plugins: [],
    // blurhash 仅在 LazyImage 里按需导入，预打包它避免 dev 首次访问时
    // 「运行时发现新依赖 → 重新优化 → 整页 reload」。
    optimizeDeps: {
      include: ['blurhash'],
    },
    vue: {
      template: {
        compilerOptions: {
        },
      },
      features: {
        // 生产构建默认用「路径 + 源码」算 scoped 样式的 data-v id。页面组件还会以
        // definePageMeta 宏的变体（?macro=true，源码不同）再编译一次，两次编译抢同一份
        // 描述符缓存，结果样式表和模板拿到不同的 id，页面的 scoped 样式整块失效（哪个页面
        // 中招随构建而变）。只按路径算，同一个文件始终是同一个 id。
        componentIdGenerator: 'filepath',
      },
    },
    worker: {
      format: 'es',
    },
  },
})

declare module '@nuxt/schema' {
  interface AppConfig {
    env: BuildInfo['env']
    buildInfo: BuildInfo
  }
}
