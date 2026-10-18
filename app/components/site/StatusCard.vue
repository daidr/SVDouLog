<script setup lang="ts">
/** 404 和出错页共用的提示卡片：标题、一句说明，下面是去首页 / 返回上一页，或重试 */
const props = defineProps<{
  title: string
  desc: string
  /** 给了就显示「重试」按钮，代替「返回上一页」 */
  onRetry?: () => void
}>()

const back = useRouter().back

const showBackBtn = ref(false)

const { t } = useI18n()

onMounted(() => {
  showBackBtn.value = history.length > 1
})

// 在布局之后注册，盖过布局按路由给的标题
useHead({ title: () => props.title })
</script>

<template>
  <div class="notfound-page-wrapper">
    <div class="decoration-wrapper transition-extra-wrapper">
      <UiNotFoundImage />
    </div>
    <div class="transition-page-wrapper">
      <div class="page-container">
        <h1 class="title">
          {{ title }}
        </h1>
        <div class="content">
          <div class="text">
            {{ desc }}
          </div>
          <div class="btn-group">
            <NuxtLink to="/" class="link-btn">
              {{ t("not_found.to_index") }}
            </NuxtLink>
            <button v-if="onRetry" type="button" class="link-btn" @click="onRetry()">
              {{ t("error_page.retry") }}
            </button>
            <ClientOnly v-else>
              <button v-if="showBackBtn" type="button" class="link-btn" @click="back()">
                {{ t("not_found.to_previous") }}
              </button>
            </ClientOnly>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notfound-page-wrapper {
  @apply w-350px sm:w-400px md:w-760px lg:w-900px h-500px;
  @apply absolute top-1/2 left-1/2 rounded-8;
  @apply transform-gpu -translate-x-1/2 -translate-y-1/2;
  @apply flex justify-between;

  .transition-page-wrapper {
    @apply bg-light dark-bg-dark w-full md:w-400px h-full mt-[env(safe-area-inset-top,0)];
    @apply shadow-2xl general-shadow;
    @apply rounded-8;
    @apply overflow-hidden;

    .page-container {
      @apply w-full h-full flex flex-col items-center justify-center select-none;

      .title {
        @apply text-7xl font-extrabold text-primary-text;
      }

      .content {
        @apply mt-40 text-lg text-primary font-medium;
      }

      .btn-group {
        @apply mt-5 flex gap-x-4 justify-center;

        .link-btn {
          @apply text-base whitespace-nowrap;
          @apply text-light dark-text-primary-10 bg-primary-5;
          @apply rounded-full relative;
          @apply cursor-pointer;
          @apply px-3 py-1.5;

          &::before {
            content: '';
            @apply absolute -top-6px -left-6px -right-6px -bottom-6px -z-1;
            @apply rounded-full;
            @apply border-4px border-primary-1 dark-border-primary-3;
            @apply transition;
            @apply transform-gpu scale-50 opacity-0;
            @apply pointer-events-none;
          }

          &:hover::before,
          &:active::before {
            @apply scale-100 opacity-100;
          }
        }
      }
    }
  }

  .decoration-wrapper {
    @apply w-0 md:w-auto flex-grow overflow-hidden;
    @apply md:pr-15 lg:pr-25;
    @apply flex items-center;

    svg {
      @apply opacity-90 w-full;
    }
  }
}
</style>
