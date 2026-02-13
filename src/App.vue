<template>
  <div class="app-root">
    <div class="overlay-shell">
      <CompactOverlayPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CompactOverlayPage from './pages/index.vue';
import { useAppStore } from './stores/app';

const store = useAppStore();
const { locale } = useI18n();

onMounted(async () => {
  await store.bootstrap();
  locale.value = store.settings.language;
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
