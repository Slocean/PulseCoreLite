<template>
  <section class="overlay-widget glass-panel">
    <header data-tauri-drag-region>
      <div>
        <h3>{{ t("overlay.title") }}</h3>
        <p>{{ t("overlay.subtitle") }}</p>
      </div>
      <div class="overlay-header-actions">
        <button class="overlay-action" type="button" @click="showConfig = !showConfig" :title="t('overlay.configure')">
          <span class="material-symbols-outlined">tune</span>
        </button>
        <button class="overlay-action" type="button" @click="hide" :title="t('overlay.close')">
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

    <div class="overlay-bars">
      <div v-if="prefs.showCpu" class="overlay-item">
        <div>
          <span>{{ t("overlay.cpu") }}</span>
          <strong>{{ snapshot.cpu.usage_pct.toFixed(1) }}%</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.cpu.usage_pct}%` }"></span></div>
      </div>

      <div v-if="prefs.showGpu" class="overlay-item">
        <div>
          <span>{{ t("overlay.gpu") }}</span>
          <strong>{{ snapshot.gpu.usage_pct == null ? t("common.na") : `${snapshot.gpu.usage_pct.toFixed(1)}%` }}</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.gpu.usage_pct ?? 0}%` }"></span></div>
      </div>

      <div v-if="prefs.showMemory" class="overlay-item">
        <div>
          <span>{{ t("overlay.memory") }}</span>
          <strong>{{ snapshot.memory.usage_pct.toFixed(1) }}%</strong>
        </div>
        <div class="bar"><span :style="{ width: `${snapshot.memory.usage_pct}%` }"></span></div>
      </div>
    </div>

    <footer>
      <div v-if="prefs.showDown">
        <span>{{ t("overlay.down") }}</span>
        <strong>{{ (snapshot.network.download_bytes_per_sec / 1024 / 1024).toFixed(2) }} MB/s</strong>
      </div>
      <div v-if="prefs.showUp">
        <span>{{ t("overlay.up") }}</span>
        <strong>{{ (snapshot.network.upload_bytes_per_sec / 1024 / 1024).toFixed(2) }} MB/s</strong>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
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
</script>
