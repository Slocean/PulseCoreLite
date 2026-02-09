<template>
  <section class="overlay-widget glass-panel">
    <header>
      <div>
        <h3>System v3</h3>
        <p>PulseCore Overlay</p>
      </div>
      <button class="overlay-action" @click="hide">
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <div class="overlay-bars">
      <div class="overlay-item">
        <div>
          <span>CPU_CORE</span>
          <strong>{{ snapshot.cpu.usage_pct.toFixed(1) }}%</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.cpu.usage_pct}%` }"></span></div>
      </div>

      <div class="overlay-item">
        <div>
          <span>GPU_MEM</span>
          <strong>{{ snapshot.gpu.usage_pct == null ? 'N/A' : `${snapshot.gpu.usage_pct.toFixed(1)}%` }}</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.gpu.usage_pct ?? 0}%` }"></span></div>
      </div>

      <div class="overlay-item">
        <div>
          <span>DDR_RAM</span>
          <strong>{{ snapshot.memory.usage_pct.toFixed(1) }}%</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.memory.usage_pct}%` }"></span></div>
      </div>
    </div>

    <footer>
      <div>
        <span>DOWN</span>
        <strong>{{ (snapshot.network.download_bytes_per_sec / 1024 / 1024).toFixed(2) }} MB/s</strong>
      </div>
      <div>
        <span>UP</span>
        <strong>{{ (snapshot.network.upload_bytes_per_sec / 1024 / 1024).toFixed(2) }} MB/s</strong>
      </div>
    </footer>
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
