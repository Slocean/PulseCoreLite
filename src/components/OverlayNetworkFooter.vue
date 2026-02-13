<template>
  <footer class="overlay-network">
    <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showUp }">
      <div class="overlay-network-label">
        <span class="material-symbols-outlined">upload</span>
        <span>{{ t('overlay.up') }}</span>
      </div>
      <div class="overlay-network-value overlay-glow-cyan">
        {{ network.uploadSpeed }}
        <span>MB/s</span>
      </div>
    </div>
    <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showLatency }">
      <div class="overlay-network-label">
        <span class="material-symbols-outlined">network_ping</span>
        <span>{{ t('overlay.latency') }}</span>
      </div>
      <div class="overlay-network-value overlay-glow-cyan">
        {{ network.latencyLabel }}
      </div>
    </div>
    <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showDown }">
      <div class="overlay-network-label">
        <span class="material-symbols-outlined">download</span>
        <span>{{ t('overlay.down') }}</span>
      </div>
      <div class="overlay-network-value overlay-glow-cyan">
        {{ network.downloadSpeed }}
        <span>MB/s</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ComputedRef } from 'vue';

import type { OverlayPrefs } from '../composables/useOverlayPrefs';

defineProps<{
  prefs: OverlayPrefs;
  network: {
    downloadSpeed: ComputedRef<string>;
    uploadSpeed: ComputedRef<string>;
    latencyLabel: ComputedRef<string>;
  };
}>();

const { t } = useI18n();
</script>
