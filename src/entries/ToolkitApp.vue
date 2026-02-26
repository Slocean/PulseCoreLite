<template>
  <div class="app-root">
    <div class="overlay-shell">
      <ToolkitPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ToolkitPage from '../pages/toolkit.vue';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { locale } = useI18n();

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('window-toolkit');
  }
  await store.bootstrap();
  locale.value = store.settings.language;
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('window-toolkit');
  }
  store.dispose();
});

watch(
  () => store.settings.language,
  lang => {
    locale.value = lang;
  }
);
</script>
