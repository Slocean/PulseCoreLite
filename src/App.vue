<template>
  <div class="app-root">
    <div class="overlay-shell" :class="{ 'overlay-shell--taskbar': windowRole === 'taskbar' }">
      <TaskbarMonitorPage v-if="windowRole === 'taskbar'" />
      <ToolkitPage v-else-if="windowRole === 'toolkit'" />
      <CompactOverlayPage v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CompactOverlayPage from './pages/index.vue';
import TaskbarMonitorPage from './pages/taskbar.vue';
import ToolkitPage from './pages/toolkit.vue';
import { api, inTauri } from './services/tauri';
import { useAppStore } from './stores/app';

const store = useAppStore();
const { locale } = useI18n();
const windowRole = ref<'main' | 'taskbar' | 'toolkit'>('main');
let contextMenuHandler: ((event: MouseEvent) => void) | null = null;

onMounted(async () => {
  if (inTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const label = getCurrentWindow().label;
      if (label === 'taskbar' || label === 'toolkit') {
        windowRole.value = label;
      } else {
        windowRole.value = 'main';
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('window-taskbar', windowRole.value === 'taskbar');
        document.documentElement.classList.toggle('window-toolkit', windowRole.value === 'toolkit');
      }
    } catch {
      // ignore
    }
  }

  // Disable the browser's default context menu in the main window.
  // (Taskbar window uses a custom Tauri context menu.)
  if (typeof window !== 'undefined' && windowRole.value === 'main') {
    contextMenuHandler = event => event.preventDefault();
    window.addEventListener('contextmenu', contextMenuHandler, true);
  }

  await store.bootstrap();
  locale.value = store.settings.language;
  if (inTauri() && windowRole.value === 'main') {
    await nextTick();
    await api.toggleOverlay(true);
  }
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('window-taskbar');
    document.documentElement.classList.remove('window-toolkit');
  }
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
