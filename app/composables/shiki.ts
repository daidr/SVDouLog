import ShikiWorker from '~~/workers/shiki?worker'

export interface UseCodeHighlightProps {
  lang: MaybeRefOrGetter<string>
  code: MaybeRefOrGetter<string>
}

export interface UseCodeHighlightReturn {
  processing: Ref<boolean>
  html: Ref<string>
}

// 全 app 共用一个常驻 Shiki worker。worker 内的单例 highlighter（WASM 引擎 + 主题 +
// 已加载语法）随之常驻：只有首次高亮付初始化代价，之后每次只是再 tokenize，毫秒级。
// 这正是修复「编辑代码块后黑字、过好久才高亮」的关键——旧实现每次高亮都新建/销毁
// worker，等于每次从零重建引擎，网络缓存也救不了（重建是 CPU 工作，不走网络）。
let sharedWorker: Worker | undefined
let reqSeq = 0
const pending = new Map<number, (html: string) => void>()

function getSharedWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new ShikiWorker()
    sharedWorker.addEventListener('message', (event: MessageEvent) => {
      const { id, html } = event.data as { id: number, html: string }
      const resolve = pending.get(id)
      if (resolve) {
        pending.delete(id)
        resolve(html)
      }
    })
  }
  return sharedWorker
}

export function useCodeHighlight(props: UseCodeHighlightProps): UseCodeHighlightReturn {
  const processing = ref(true)
  const html = ref('')
  if (import.meta.env.SSR) {
    return {
      processing,
      html,
    }
  }

  const lang = computed(() => toValue(props.lang))
  const code = computed(() => toValue(props.code))

  // 本实例最近一次请求的 id；只应用它的结果，丢弃被快速编辑产生的过期结果。
  let latestId = 0

  watch([lang, code], () => {
    processing.value = true
    const id = ++reqSeq
    latestId = id
    pending.set(id, (resultHtml) => {
      if (id !== latestId)
        return
      html.value = resultHtml
      processing.value = false
    })
    getSharedWorker().postMessage({ id, lang: lang.value, code: code.value })
  }, {
    immediate: true,
  })

  onScopeDispose(() => {
    // 作废本实例的挂起回调；worker 是共享常驻的，不在这里终止。
    latestId = -1
  })

  return {
    processing,
    html,
  }
}
