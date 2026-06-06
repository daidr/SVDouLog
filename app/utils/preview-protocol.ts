/**
 * SVP —— StoryVerse Preview Protocol
 *
 * 编辑器（Host，嵌入 iframe 的一侧）与预览前端（Guest，被嵌入的一侧）之间的
 * postMessage 通信协议。设计目标是「完备且通用」：任意前端只要实现 Guest 端，
 * 就能作为 story-verse 编辑器的实时预览端接入。
 *
 * 能力：
 *   - 版本协商（__svp 标记 + protocol 字段）
 *   - 握手（guest:ready ↔ host:hello），无状态恢复（iframe 重载即重新握手）
 *   - 文档全量快照推送（host:doc，单调 seq 防乱序 + ack）
 *   - 主题同步（host:theme）
 *   - 双向滚动同步（host:scroll / guest:scroll）
 *   - 内部链接拦截回传（guest:nav）
 *   - 能力声明（capabilities）做前向兼容：仅在对端声明某能力时才使用它
 *
 * 安全：两侧都强校验 message 来源（origin + source window）并以命名空间标记过滤
 * 外来 message；Host 永远以显式 origin 发送（绝不用 '*'）。
 *
 * ⚠️ 本文件是 story-verse 仓库 `packages/shared/src/preview-protocol.ts` 的逐字副本。
 * 两仓库不共享 npm 包，修改协议时务必同步两侧。
 */

export const SVP_VERSION = 1

/** 信封命名空间 + 版本标记，用于过滤掉非本协议的 message。 */
export const SVP_MARKER = SVP_VERSION

export type SvpHostKind = 'host:hello' | 'host:doc' | 'host:theme' | 'host:scroll' | 'host:ping'
export type SvpGuestKind
  = | 'guest:ready'
    | 'guest:ack'
    | 'guest:scroll'
    | 'guest:nav'
    | 'guest:error'
    | 'guest:pong'
export type SvpKind = SvpHostKind | SvpGuestKind

/** 可选能力标识，握手时双方各自声明，未声明的能力对端不会使用。 */
export type SvpCapability = 'theme' | 'scroll' | 'nav'

/** 协议消息信封。 */
export interface SvpEnvelope<T = unknown> {
  /** 命名空间 + 版本标记，恒为 {@link SVP_VERSION}。 */
  __svp: typeof SVP_VERSION
  /** 唯一消息 id，用于 ack 关联。 */
  id: string
  kind: SvpKind
  /** 发送方时间戳（ms）。 */
  ts: number
  /** ack 类消息回填被确认消息的 id。 */
  ackId?: string
  data?: T
}

/** 预览文档快照——编辑器侧把「当前未保存的文档」打包成与正式文章一致的字段。 */
export interface PreviewDoc {
  type: 'post' | 'note' | 'page'
  title: string
  markdown: string
  summary: string
  slug: string | null
  tags: string[]
  categoryName: string
  heroId: number | null
  heroEtag: string | null
  mood: string | null
  weather: string | null
  /** ISO 字符串；null 表示用「此刻」。 */
  publishedAt: string | null
}

export interface SvpHelloData {
  protocol: number
  capabilities: SvpCapability[]
}
export interface SvpReadyData {
  protocol: number
  capabilities: SvpCapability[]
}
export interface SvpDocData {
  seq: number
  doc: PreviewDoc
}
export interface SvpThemeData {
  mode: 'light' | 'dark'
}
export interface SvpScrollData {
  /** 0..1 的滚动比例。 */
  ratio: number
}
export interface SvpAckData {
  seq: number
}
export interface SvpNavData {
  href: string
  /** 是否站内链接（相对路径 / 同源）。 */
  internal: boolean
}
export interface SvpErrorData {
  message: string
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

let fallbackCounter = 0
function genId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  // 老环境兜底：时间戳 + 自增 + 随机段，唯一性足够本协议关联用。
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER
  return `svp-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): number {
  return Date.now()
}

/** 运行时守卫：判断任意值是否为本协议信封。 */
export function isEnvelope(value: unknown): value is SvpEnvelope {
  if (typeof value !== 'object' || value === null)
    return false
  const v = value as Record<string, unknown>
  return v.__svp === SVP_VERSION && typeof v.id === 'string' && typeof v.kind === 'string'
}

/** 构造一个信封。 */
export function makeEnvelope<T>(kind: SvpKind, data?: T, ackId?: string): SvpEnvelope<T> {
  const env: SvpEnvelope<T> = { __svp: SVP_VERSION, id: genId(), kind, ts: now() }
  if (data !== undefined)
    env.data = data
  if (ackId !== undefined)
    env.ackId = ackId
  return env
}

/** 从一个 URL 安全地取 origin；非法 URL 返回 null。 */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  }
  catch {
    return null
  }
}

type Handler = (env: SvpEnvelope) => void

// ---------------------------------------------------------------------------
// Host —— 编辑器侧（嵌入 iframe 的一方）
// ---------------------------------------------------------------------------

export interface SvpHostOptions {
  /** 解析当前 iframe 的 contentWindow；iframe 重载后会返回新的 window，故用函数。 */
  target: () => Window | null
  /** 预览页 origin（从配置 URL 推出），所有发送都以此为 targetOrigin，绝不用 '*'。 */
  origin: string
  /** 本端声明的能力。 */
  capabilities?: SvpCapability[]
}

/**
 * Host 端协议状态机。框架无关，由上层（如 Vue composable）负责生命周期与数据接入。
 */
export class SvpHost {
  private readonly target: () => Window | null
  private readonly origin: string
  private readonly capabilities: SvpCapability[]
  private handlers = new Set<Handler>()

  private listening = false
  private handshook = false
  private seq = 0
  private guestCaps: SvpCapability[] = []

  /** 最近一次的文档 / 主题，握手完成（或 guest 重连）时用于全量重放。 */
  private latestDoc: PreviewDoc | null = null
  private latestTheme: SvpThemeData['mode'] | null = null

  private readonly onMessage = (event: MessageEvent) => {
    // 安全：来源 window 与 origin 双重校验。
    if (event.source !== this.target())
      return
    if (event.origin !== this.origin)
      return
    if (!isEnvelope(event.data))
      return
    const env = event.data
    switch (env.kind) {
      case 'guest:ready': {
        const data = env.data as SvpReadyData | undefined
        this.guestCaps = data?.capabilities ?? []
        this.handshook = true
        // 回握手并把当前状态全量重放（覆盖 guest 首连与重载恢复两种场景）。
        this.post('host:hello', { protocol: SVP_VERSION, capabilities: this.capabilities } satisfies SvpHelloData)
        if (this.latestDoc)
          this.post('host:doc', { seq: ++this.seq, doc: this.latestDoc } satisfies SvpDocData)
        if (this.latestTheme && this.peerSupports('theme'))
          this.post('host:theme', { mode: this.latestTheme } satisfies SvpThemeData)
        // 也对上层暴露握手事件，便于观察连接状态。
        this.emit(env)
        break
      }
      case 'guest:ack':
      case 'guest:scroll':
      case 'guest:nav':
      case 'guest:error':
      case 'guest:pong':
        this.emit(env)
        break
      default:
        // 忽略未知 / host:* 回声
        break
    }
  }

  constructor(options: SvpHostOptions) {
    this.target = options.target
    this.origin = options.origin
    this.capabilities = options.capabilities ?? ['theme', 'scroll', 'nav']
  }

  private peerSupports(cap: SvpCapability): boolean {
    return this.guestCaps.includes(cap)
  }

  private post<T>(kind: SvpHostKind, data?: T, ackId?: string): void {
    const win = this.target()
    if (!win)
      return
    win.postMessage(makeEnvelope(kind, data, ackId), this.origin)
  }

  private emit(env: SvpEnvelope): void {
    for (const h of this.handlers) h(env)
  }

  /** 注册消息回调，返回取消函数。 */
  on(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** 开始监听 message（幂等）。 */
  start(): void {
    if (this.listening)
      return
    window.addEventListener('message', this.onMessage)
    this.listening = true
  }

  /** 停止监听并重置握手状态（幂等）。 */
  stop(): void {
    if (!this.listening)
      return
    window.removeEventListener('message', this.onMessage)
    this.listening = false
    this.handshook = false
    this.guestCaps = []
  }

  get connected(): boolean {
    return this.handshook
  }

  /** 推送文档快照；握手前仅缓存，握手时自动重放。 */
  sendDoc(doc: PreviewDoc): void {
    this.latestDoc = doc
    if (this.handshook)
      this.post('host:doc', { seq: ++this.seq, doc } satisfies SvpDocData)
  }

  /** 推送主题；仅当 guest 声明支持 theme 时才真正发送。 */
  sendTheme(mode: SvpThemeData['mode']): void {
    this.latestTheme = mode
    if (this.handshook && this.peerSupports('theme'))
      this.post('host:theme', { mode } satisfies SvpThemeData)
  }

  /** 推送滚动比例；仅当 guest 声明支持 scroll 时才发送。 */
  sendScroll(ratio: number): void {
    if (this.handshook && this.peerSupports('scroll'))
      this.post('host:scroll', { ratio } satisfies SvpScrollData)
  }

  /** 探活。 */
  ping(): void {
    if (this.handshook)
      this.post('host:ping')
  }
}

// ---------------------------------------------------------------------------
// Guest —— 预览侧（被嵌入 iframe 的一方）
// ---------------------------------------------------------------------------

export interface SvpGuestOptions {
  capabilities?: SvpCapability[]
  /** ready 重发间隔（ms）。 */
  retryInterval?: number
  /** ready 最大重发次数。 */
  maxRetries?: number
}

/**
 * Guest 端协议状态机。挂载后 `start()` 即向 parent 发 ready 并重试，直到收到
 * host:hello 锁定 host origin。框架无关。
 */
export class SvpGuest {
  private readonly capabilities: SvpCapability[]
  private readonly retryInterval: number
  private readonly maxRetries: number
  private handlers = new Set<Handler>()

  private listening = false
  private handshook = false
  private hostCaps: SvpCapability[] = []
  /** 握手后锁定的 host origin；之前发送 ready 用 referrer origin 兜底。 */
  private hostOrigin: string | null = null
  /** host 窗口：iframe 场景是 parent，弹出窗口场景是 opener。start() 时解析。 */
  private hostWindow: Window | null = null
  private readonly expectedOrigin: string | null
  private retryTimer: ReturnType<typeof setInterval> | null = null
  private retries = 0

  private readonly onMessage = (event: MessageEvent) => {
    // 安全：必须来自 host 窗口（iframe 的 parent 或弹窗的 opener）。
    if (event.source !== this.hostWindow)
      return
    // 握手前若能从 referrer 推出期望 origin，则比对；握手后锁定 hostOrigin。
    const expect = this.hostOrigin ?? this.expectedOrigin
    if (expect && event.origin !== expect)
      return
    if (!isEnvelope(event.data))
      return
    const env = event.data
    switch (env.kind) {
      case 'host:hello': {
        const data = env.data as SvpHelloData | undefined
        this.hostCaps = data?.capabilities ?? []
        this.hostOrigin = event.origin
        this.handshook = true
        this.stopRetry()
        this.emit(env)
        break
      }
      case 'host:ping':
        this.post('guest:pong')
        break
      case 'host:doc':
      case 'host:theme':
      case 'host:scroll':
        this.emit(env)
        break
      default:
        break
    }
  }

  constructor(options: SvpGuestOptions = {}) {
    this.capabilities = options.capabilities ?? ['theme', 'scroll', 'nav']
    this.retryInterval = options.retryInterval ?? 300
    this.maxRetries = options.maxRetries ?? 20
    this.expectedOrigin = referrerOrigin()
  }

  private peerSupports(cap: SvpCapability): boolean {
    return this.hostCaps.includes(cap)
  }

  private post<T>(kind: SvpGuestKind, data?: T, ackId?: string): void {
    // 握手前只发 ready（无敏感数据），targetOrigin 用 referrer origin 兜底，取不到才 '*'。
    const targetOrigin = this.hostOrigin ?? this.expectedOrigin ?? '*'
    this.hostWindow?.postMessage(makeEnvelope(kind, data, ackId), targetOrigin)
  }

  private emit(env: SvpEnvelope): void {
    for (const h of this.handlers) h(env)
  }

  private sendReady(): void {
    this.post('guest:ready', { protocol: SVP_VERSION, capabilities: this.capabilities } satisfies SvpReadyData)
  }

  private stopRetry(): void {
    if (this.retryTimer != null) {
      clearInterval(this.retryTimer)
      this.retryTimer = null
    }
  }

  /** 注册消息回调，返回取消函数。 */
  on(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** 开始监听并发起握手（幂等）。 */
  start(): void {
    if (this.listening)
      return
    this.hostWindow = resolveHostWindow()
    window.addEventListener('message', this.onMessage)
    this.listening = true
    this.retries = 0
    this.sendReady()
    this.retryTimer = setInterval(() => {
      this.retries += 1
      if (this.handshook || this.retries >= this.maxRetries) {
        this.stopRetry()
        return
      }
      this.sendReady()
    }, this.retryInterval)
  }

  /** 停止监听并重置（幂等）。 */
  stop(): void {
    this.stopRetry()
    if (!this.listening)
      return
    window.removeEventListener('message', this.onMessage)
    this.listening = false
    this.handshook = false
    this.hostCaps = []
    this.hostOrigin = null
    this.hostWindow = null
  }

  get connected(): boolean {
    return this.handshook
  }

  /** 确认已应用某个 host:doc。 */
  ack(seq: number, docEnvelopeId: string): void {
    this.post('guest:ack', { seq } satisfies SvpAckData, docEnvelopeId)
  }

  /** 回传预览侧滚动比例；仅当 host 声明支持 scroll 时发送。 */
  sendScroll(ratio: number): void {
    if (this.handshook && this.peerSupports('scroll'))
      this.post('guest:scroll', { ratio } satisfies SvpScrollData)
  }

  /** 回传被拦截的链接点击；仅当 host 声明支持 nav 时发送。 */
  sendNav(href: string, internal: boolean): void {
    if (this.handshook && this.peerSupports('nav'))
      this.post('guest:nav', { href, internal } satisfies SvpNavData)
  }

  /** 回传渲染错误。 */
  sendError(message: string): void {
    this.post('guest:error', { message } satisfies SvpErrorData)
  }
}

/** 从 document.referrer 取 origin（取不到返回 null）。 */
function referrerOrigin(): string | null {
  if (typeof document === 'undefined' || !document.referrer)
    return null
  return originOf(document.referrer)
}

/**
 * 解析 host 窗口：弹出窗口（被 window.open 打开）时 host 是 opener；
 * 内嵌 iframe 时 host 是 parent。两种拓扑都能作为编辑器预览端接入。
 */
function resolveHostWindow(): Window | null {
  if (typeof window === 'undefined')
    return null
  if (window.opener && window.opener !== window)
    return window.opener as Window
  return window.parent
}
