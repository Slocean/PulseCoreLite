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
let contextMenuHandler: ((event: MouseEvent) => void) | null = null;

onMounted(async () => {
  // Disable the browser's default context menu in the main window.
  if (typeof window !== 'undefined') {
    contextMenuHandler = event => event.preventDefault();
    window.addEventListener('contextmenu', contextMenuHandler, true);
  }

  await store.bootstrap();
  locale.value = store.settings.language;
  if (inTauri()) {
    await nextTick();
    await api.toggleOverlay(true);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined' && contextMenuHandler) {
    window.removeEventListener('contextmenu', contextMenuHandler, true);
    contextMenuHandler = null;
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
