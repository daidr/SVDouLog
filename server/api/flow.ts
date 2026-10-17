import type { SvFlowResponse } from '../utils/sv-flow'
import { SV_CACHE, svCacheMaxAge } from '../utils/sv-cache'
import { mapFlowItem } from '../utils/sv-flow'

const { apiEntry } = useRuntimeConfig()

/** 与 story-verse `FlowQueryDTO` 的 size 上限保持一致；douLog 暂时按 10 条/页滚动。 */
const PAGE_SIZE = 10

/**
 * 公开内容流 —— 直接代理到 story-verse `/api/flow`，返回 post + note，置顶的在前，其余按
 * `publishedAt DESC, id DESC` 混合后的时间线。
 *
 * 选择 page+size 而非 cursor 是为了对齐前端 `page = list.length / size + 1`
 * 的滚动加载语义；服务端仍是同一组数据，只是使用 offset 分页。
 *
 * SWR 5 秒沿用旧版策略：流的 head 区域允许略微陈旧以换取列表请求被 nitro
 * 在站点内统一缓存。
 */
export default cachedEventHandler(
  async (event) => {
    let page
      = ((getQuery(event).page?.toString() || '1') as unknown as number) - 0

    if (Number.isNaN(page) || page < 1) {
      page = 1
    }

    const result = await $fetch<SvFlowResponse>('/api/flow', {
      baseURL: apiEntry,
      query: {
        page,
        size: PAGE_SIZE,
      },
    })

    return {
      list: result.list.map(mapFlowItem),
      total: result.total,
      hasNext: result.hasNext,
    }
  },
  {
    name: SV_CACHE.flow,
    swr: true,
    maxAge: svCacheMaxAge(5),
  },
)
