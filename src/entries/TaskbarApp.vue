<template>
  <div class="app-root">
    <div class="overlay-shell overlay-shell--taskbar">
      <TaskbarMonitorPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import TaskbarMonitorPage from '../pages/taskbar.vue';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { locale } = useI18n();

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('window-taskbar');
  }
  await store.bootstrap();
  locale.value = store.settings.language;
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('window-taskbar');
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
