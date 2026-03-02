<template>
  <div class="app-root">
    <div class="overlay-shell">
      <ReminderScreenPage v-if="isReminderScreen" />
      <ToolkitPage v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ReminderScreenPage from '../pages/ReminderScreenPage.vue';
import ToolkitPage from '../pages/toolkit.vue';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { locale } = useI18n();
const isReminderScreen = computed(() => {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('reminderScreen') === '1';
});

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('window-toolkit');
  }
  if (!isReminderScreen.value) {
    await store.bootstrap();
    locale.value = store.settings.language;
  } else if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('pulsecorelite.settings');
      if (raw) {
        const parsed = JSON.parse(raw) as { language?: 'zh-CN' | 'en-US' };
        if (parsed.language === 'en-US' || parsed.language === 'zh-CN') {
          locale.value = parsed.language;
        }
      }
    } catch {
      // ignore
    }
  }
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
    if (isReminderScreen.value) {
      return;
    }
    locale.value = lang;
  }
);
</script>
