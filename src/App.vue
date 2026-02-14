<template>
  <div class="app-root">
    <div class="overlay-shell" :class="{ 'overlay-shell--taskbar': windowRole === 'taskbar' }">
      <CompactOverlayPage v-if="windowRole !== 'taskbar'" />
      <TaskbarMonitorPage v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CompactOverlayPage from './pages/index.vue';
import TaskbarMonitorPage from './pages/taskbar.vue';
import { useOverlayPrefs } from './composables/useOverlayPrefs';
import { api, inTauri } from './services/tauri';
import { useAppStore } from './stores/app';

const store = useAppStore();
const { locale } = useI18n();
const windowRole = ref<'main' | 'taskbar'>('main');
useOverlayPrefs();

onMounted(async () => {
  if (inTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      windowRole.value = getCurrentWindow().label === 'taskbar' ? 'taskbar' : 'main';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('window-taskbar', windowRole.value === 'taskbar');
      }
    } catch {
      // ignore
    }
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
