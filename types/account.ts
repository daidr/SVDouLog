/** 已登录读者（`/api/account/session` 的响应）。 */
export interface IReaderAccount {
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  /** 邮箱的 SHA-256，拼 gravatar 头像 */
  emailHash: string
}
