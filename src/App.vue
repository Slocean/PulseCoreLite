<template>
  <div class="app-root">
    <div class="overlay-shell">
      <CompactOverlayPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CompactOverlayPage from './pages/index.vue';
import { api, inTauri } from './services/tauri';
import { useAppStore } from './stores/app';

const store = useAppStore();
const { locale } = useI18n();

onMounted(async () => {
  await store.bootstrap();
  locale.value = store.settings.language;
  if (inTauri()) {
    await nextTick();
    await api.toggleOverlay(true);
  }
});

onUnmounted(() => {
  store.dispose();
});

watch(
  () => store.settings.language,
  lang => {
    locale.value = lang;
  }
);
</script>
