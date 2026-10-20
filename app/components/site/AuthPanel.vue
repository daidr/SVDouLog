<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="auth-wrapper">
    <section class="auth-panel">
      <h1 class="auth-panel__title">
        {{ title }}
      </h1>
      <slot />
    </section>
  </div>
</template>

<!-- 不加 scoped：表单元素来自各页面的 slot，按 .auth-panel 命名空间收住 -->
<style lang="scss">
.auth-wrapper {
  @apply w-full flex flex-col items-stretch;
}

.auth-panel {
  @apply w-full bg-light dark-bg-dark;
  @apply px-5 py-6 sm:(px-8 py-8);
  @apply sm:rounded-8;
  @apply sm:shadow-2xl general-shadow;
  view-transition-name: main-wrapper;

  &__title {
    @apply text-xl md:text-2xl font-bold text-primary dark-text-primary-8;
    @apply mb-6;
  }

  // 表单本身限宽居左，宽屏上不至于拉成一长条
  form,
  .auth-body {
    @apply flex flex-col gap-3 max-w-md;
  }

  .auth-input {
    @apply w-full px-3 py-2 rounded-xl;
    @apply bg-light dark-bg-dark/60;
    @apply border border-primary-2/60 dark-border-primary-4/60;
    @apply text-dark dark-text-light;
    @apply placeholder:text-primary-text/60;
    @apply transition-colors;

    &:focus {
      @apply outline-none;
      @apply border-primary dark-border-primary-7;
    }
  }

  .auth-btn {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl;
    @apply text-base font-medium;
    @apply transition-colors;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply bg-primary text-light dark-bg-primary-7;
    @apply hover:bg-primary-7 dark-hover-bg-primary-8;
  }

  .auth-btn--ghost {
    @apply bg-primary-1/70 text-primary dark-bg-primary-5/50 dark-text-primary-9;
    @apply hover:bg-primary-2/50 dark-hover-bg-primary-5/80;
  }

  .auth-error {
    @apply text-sm text-red-600 dark-text-red-400;
  }

  .auth-notice {
    @apply text-base text-primary-text;
    overflow-wrap: anywhere;
  }

  .auth-divider {
    @apply flex items-center gap-3 text-sm text-primary-text/70;

    &::before,
    &::after {
      content: '';
      @apply flex-1 h-px bg-primary-2/60 dark-bg-primary-4/60;
    }
  }

  .auth-check {
    @apply flex items-center gap-2 text-sm text-primary-text;
    @apply cursor-pointer select-none;
  }

  .auth-links {
    @apply flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-primary-text;

    a,
    button {
      @apply transition-colors;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;

      &:hover {
        @apply text-primary dark-text-primary-8;
      }
    }
  }
}
</style>
