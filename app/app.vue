<script setup lang="ts">
useAppShell()

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
</script>

<template>
  <CommonWappalyzerCheat />
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
    <CommonRouterTransition ref="routerTransition" />
  </NuxtLayout>
</template>
