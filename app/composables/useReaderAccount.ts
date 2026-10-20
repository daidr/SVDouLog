import type { IReaderAccount } from '~~/types/account'

let pending: Promise<void> | null = null

/**
 * 当前读者的登录态，全站共享。
 *
 * 只在浏览器里取：文章页的 HTML 会被缓存，SSR 时把某个读者的身份渲染进去，
 * 别人就会看到。`account` 为 undefined 表示还没取到，null 表示未登录。
 */
export function useReaderAccount() {
  const account = useState<IReaderAccount | null | undefined>('reader-account', () => undefined)

  function refresh() {
    pending ??= $fetch<IReaderAccount | null>('/api/account/session')
      .then((value) => {
        account.value = value
      })
      .catch(() => {
        account.value = null
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  async function signOut() {
    await $fetch('/api/auth/sign-out', { method: 'POST' })
    account.value = null
  }

  if (import.meta.client && account.value === undefined) {
    onMounted(refresh)
  }

  return { account, refresh, signOut }
}

/**
 * 登录 / 注册完成后回到哪里：只接受本站路径，防止被拼成跳去外站的链接。
 */
export function useAccountRedirect() {
  const route = useRoute()
  return computed(() => {
    const raw = route.query.redirect
    const value = typeof raw === 'string' ? raw : ''
    return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/blog'
  })
}

/**
 * Better Auth 的回调地址必须是绝对地址：相对路径会被它拼到 story-verse 的域名上。
 */
export function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).toString()
}

/**
 * Better Auth 的错误码 → 文案。未知的错误码退回通用提示，不把英文原文抛给读者。
 */
export function authErrorMessage(err: any, t: (key: string) => string): string {
  if (err?.statusCode === 429 || err?.status === 429) return t('account.errors.too_many_requests')
  const code: string | undefined = err?.data?.code
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return t('account.errors.invalid_credentials')
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return t('account.errors.email_taken')
    case 'PASSWORD_TOO_SHORT':
      return t('account.errors.password_too_short')
    case 'PASSWORD_TOO_LONG':
      return t('account.errors.password_too_long')
    case 'INVALID_EMAIL':
      return t('account.errors.email_invalid')
    case 'INVALID_TOKEN':
      return t('account.errors.link_invalid')
    case 'BANNED_USER':
      return t('account.errors.banned')
    case 'INVALID_CODE':
      return t('account.errors.invalid_code')
    case 'INVALID_BACKUP_CODE':
      return t('account.errors.invalid_backup_code')
    case 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE':
    case 'INVALID_TWO_FACTOR_COOKIE':
      return t('account.errors.two_factor_expired')
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return t('account.errors.too_many_requests')
    default:
      return t('account.errors.generic')
  }
}
