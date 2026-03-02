<template>
  <div class="app-root">
    <div class="overlay-shell">
      <CompactOverlayPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue';

import CompactOverlayPage from './pages/index.vue';
import { api, inTauri } from './services/tauri';
import { useEntryBootstrap } from './entries/useEntryBootstrap';

useEntryBootstrap({
  disableContextMenu: true,
  async afterBootstrap() {
    if (!inTauri()) {
      return;
    }
    await nextTick();
    await api.toggleOverlay(true);
  }
});
</script>
