<template>
  <section class="overlay-card glass-panel">
    <header>
      <h3>PulseCore Overlay</h3>
      <button @click="hide">Hide</button>
    </header>
    <div class="overlay-row">
      <span>CPU</span>
      <strong>{{ snapshot.cpu.usage_pct.toFixed(1) }}%</strong>
    </div>
    <div class="overlay-row">
      <span>GPU</span>
      <strong>{{ snapshot.gpu.usage_pct == null ? "N/A" : `${snapshot.gpu.usage_pct.toFixed(1)}%` }}</strong>
    </div>
    <div class="overlay-row">
      <span>RAM</span>
      <strong>{{ snapshot.memory.usage_pct.toFixed(1) }}%</strong>
    </div>
    <div class="overlay-row">
      <span>Down</span>
      <strong>{{ (snapshot.network.download_bytes_per_sec / 1024 / 1024).toFixed(2) }} MB/s</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useAppStore } from "../stores/app";

const store = useAppStore();
const snapshot = computed(() => store.snapshot);

function hide() {
  store.toggleOverlay(false);
}
</script>
