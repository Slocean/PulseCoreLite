<template>
  <section class="overlay-widget overlay-widget--cyber glass-panel">
    <header data-tauri-drag-region>
      <div class="overlay-title">
        <h3>{{ t("overlay.title") }}</h3>
        <p>PULSECORE v2.0.4_CYBER</p>
      </div>
      <div class="overlay-header-actions">
        <button class="overlay-action" type="button" @click="showConfig = !showConfig" :title="t('overlay.configure')">
          <span class="material-symbols-outlined">tune</span>
        </button>
        <button class="overlay-action overlay-action--danger" type="button" @click="hide" :title="t('overlay.close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <div v-if="showConfig" class="overlay-config">
      <label><input v-model="prefs.showCpu" type="checkbox" /> {{ t("overlay.showCpu") }}</label>
      <label><input v-model="prefs.showGpu" type="checkbox" /> {{ t("overlay.showGpu") }}</label>
      <label><input v-model="prefs.showMemory" type="checkbox" /> {{ t("overlay.showMemory") }}</label>
      <label><input v-model="prefs.showDown" type="checkbox" /> {{ t("overlay.showDown") }}</label>
      <label><input v-model="prefs.showUp" type="checkbox" /> {{ t("overlay.showUp") }}</label>
    </div>

    <div class="overlay-metrics">
      <div v-if="prefs.showCpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory</span>
            <span class="overlay-metric-name">{{ t("overlay.cpu") }}</span>
          </div>
          <span class="overlay-metric-value overlay-glow-cyan">{{ cpuUsageLabel }}</span>
        </div>
        <div class="overlay-progress">
          <span class="overlay-progress-fill overlay-progress-fill--cyan" :style="{ width: `${cpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showGpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--gpu">developer_board</span>
            <span class="overlay-metric-name">{{ t("overlay.gpu") }}</span>
          </div>
          <span class="overlay-metric-value overlay-glow-pink">{{ gpuUsageLabel }}</span>
        </div>
        <div class="overlay-progress">
          <span class="overlay-progress-fill overlay-progress-fill--pink" :style="{ width: `${gpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showMemory" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory_alt</span>
            <span class="overlay-metric-name">{{ t("overlay.memory") }}</span>
          </div>
          <span class="overlay-metric-value overlay-glow-cyan">{{ memoryUsageLabel }}</span>
        </div>
        <div class="overlay-progress">
          <span class="overlay-progress-fill overlay-progress-fill--cyan" :style="{ width: `${memoryUsagePct}%` }"></span>
        </div>
      </div>
    </div>

    <div class="overlay-divider"></div>

    <footer class="overlay-network">
      <div v-if="prefs.showDown" class="overlay-network-item">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">download</span>
          <span>{{ t("overlay.down") }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ downloadSpeed }}
          <span>MB/s</span>
        </div>
      </div>
      <div v-if="prefs.showUp" class="overlay-network-item">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">upload</span>
          <span>{{ t("overlay.up") }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ uploadSpeed }}
          <span>MB/s</span>
        </div>
      </div>
    </footer>

    <div class="overlay-status">
      <div class="overlay-status-left">
        <span class="overlay-status-dot"></span>
        <span>SYSTEM STABLE</span>
      </div>
      <span>Uptime: {{ uptimeLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useAppStore } from "../stores/app";

const OVERLAY_PREF_KEY = "pulsecore.overlay_prefs";

interface OverlayPrefs {
  showCpu: boolean;
  showGpu: boolean;
  showMemory: boolean;
  showDown: boolean;
  showUp: boolean;
}

const { t } = useI18n();
const store = useAppStore();
const snapshot = computed(() => store.snapshot);
const showConfig = ref(false);
const startedAt = Date.now();
const uptimeLabel = ref("00:00:00");
let uptimeTimer: number | undefined;

const cpuUsagePct = computed(() => snapshot.value.cpu.usage_pct);
const gpuUsagePct = computed(() => snapshot.value.gpu.usage_pct ?? 0);
const memoryUsagePct = computed(() => snapshot.value.memory.usage_pct);
const cpuUsageLabel = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(1)}%`);
const gpuUsageLabel = computed(() =>
  snapshot.value.gpu.usage_pct == null ? t("common.na") : `${snapshot.value.gpu.usage_pct.toFixed(1)}%`
);
const memoryUsageLabel = computed(() => `${snapshot.value.memory.usage_pct.toFixed(1)}%`);
const downloadSpeed = computed(() => (snapshot.value.network.download_bytes_per_sec / 1024 / 1024).toFixed(2));
const uploadSpeed = computed(() => (snapshot.value.network.upload_bytes_per_sec / 1024 / 1024).toFixed(2));

const prefs = reactive<OverlayPrefs>(loadPrefs());

watch(
  prefs,
  (next) => {
    localStorage.setItem(OVERLAY_PREF_KEY, JSON.stringify(next));
  },
  { deep: true }
);

function loadPrefs(): OverlayPrefs {
  const fallback: OverlayPrefs = {
    showCpu: true,
    showGpu: true,
    showMemory: true,
    showDown: true,
    showUp: true
  };

  try {
    const raw = localStorage.getItem(OVERLAY_PREF_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<OverlayPrefs>;
    return {
      showCpu: parsed.showCpu ?? fallback.showCpu,
      showGpu: parsed.showGpu ?? fallback.showGpu,
      showMemory: parsed.showMemory ?? fallback.showMemory,
      showDown: parsed.showDown ?? fallback.showDown,
      showUp: parsed.showUp ?? fallback.showUp
    };
  } catch {
    return fallback;
  }
}

function hide() {
  void store.toggleOverlay(false);
}

function formatUptime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateUptime() {
  uptimeLabel.value = formatUptime(Date.now() - startedAt);
}

onMounted(() => {
  updateUptime();
  uptimeTimer = window.setInterval(updateUptime, 1000);
});

onUnmounted(() => {
  if (uptimeTimer) {
    window.clearInterval(uptimeTimer);
  }
});
</script>
