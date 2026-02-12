<template>
  <section ref="overlayRef" class="overlay-widget overlay-widget--cyber" @dblclick.prevent.stop>
    <header>
      <div class="overlay-title">
        <h3>{{ t('overlay.title') }}</h3>
        <p>{{ t('overlay.subtitle') }} v{{ appVersion }}</p>
      </div>
      <div class="overlay-header-actions">
        <div class="overlay-drag" @mousedown.stop="startDragging">
          <span class="material-symbols-outlined">drag_indicator</span>
        </div>
        <button
          class="overlay-action"
          type="button"
          @mousedown.stop
          @click="showConfig = !showConfig"
          :title="t('overlay.configure')">
          <span class="material-symbols-outlined">tune</span>
        </button>
        <button
          class="overlay-action overlay-action--danger"
          type="button"
          @mousedown.stop
          @click="hide"
          :title="t('overlay.close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <div v-if="overlayDisplay.show_hardware_info" class="overlay-hardware">
      {{ hardwareInfoLabel }}
    </div>

    <div v-if="showConfig" class="overlay-config" @mousedown.stop>
      <label>
        <input v-model="prefs.showCpu" type="checkbox" />
        {{ t('overlay.showCpu') }}
      </label>
      <label>
        <input v-model="prefs.showGpu" type="checkbox" />
        {{ t('overlay.showGpu') }}
      </label>
      <label>
        <input v-model="prefs.showMemory" type="checkbox" />
        {{ t('overlay.showMemory') }}
      </label>
      <label>
        <input v-model="prefs.showDisk" type="checkbox" />
        {{ t('overlay.showDisk') }}
      </label>
      <label>
        <input v-model="prefs.showDown" type="checkbox" />
        {{ t('overlay.showDown') }}
      </label>
      <label>
        <input v-model="prefs.showUp" type="checkbox" />
        {{ t('overlay.showUp') }}
      </label>
    </div>

    <div class="overlay-metrics">
      <div v-if="prefs.showCpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory</span>
            <span class="overlay-metric-name">{{ t('overlay.cpu') }}</span>
          </div>
          <div class="overlay-metric-values">
            <span v-if="overlayDisplay.show_values" class="overlay-metric-value-sub">{{ cpuDetailLabel }}</span>
            <span v-if="overlayDisplay.show_percent" class="overlay-metric-value overlay-glow-cyan">
              {{ cpuPercentLabel }}
            </span>
          </div>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill overlay-progress-fill--cyan"
            :style="{ width: `${cpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showGpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--gpu">developer_board</span>
            <span class="overlay-metric-name">{{ t('overlay.gpu') }}</span>
          </div>
          <div class="overlay-metric-values">
            <span v-if="overlayDisplay.show_values" class="overlay-metric-value-sub">{{ gpuDetailLabel }}</span>
            <span v-if="overlayDisplay.show_percent" class="overlay-metric-value overlay-glow-pink">
              {{ gpuPercentLabel }}
            </span>
          </div>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill overlay-progress-fill--pink"
            :style="{ width: `${gpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showMemory" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory_alt</span>
            <span class="overlay-metric-name">{{ t('overlay.memory') }}</span>
          </div>
          <div class="overlay-metric-values">
            <span v-if="overlayDisplay.show_values" class="overlay-metric-value-sub">{{ memoryUsageLabel }}</span>
            <span v-if="overlayDisplay.show_percent" class="overlay-metric-value overlay-glow-cyan">
              {{ memoryPercentLabel }}
            </span>
          </div>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill overlay-progress-fill--cyan"
            :style="{ width: `${memoryUsagePct}%` }"></span>
        </div>
      </div>

      <template v-if="prefs.showDisk">
        <div v-for="disk in disks" :key="disk.name" class="overlay-metric">
          <div class="overlay-metric-top">
            <div class="overlay-metric-label">
              <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">hard_drive</span>
              <span class="overlay-metric-name">{{ disk.name }}</span>
            </div>
            <div class="overlay-metric-values overlay-metric-values--disk">
              <div v-if="overlayDisplay.show_values" class="overlay-metric-value-block">
                <span class="overlay-metric-value-sub">{{ diskUsageLabel(disk) }}</span>
                <span class="overlay-metric-value-io">{{ diskIoLabel(disk) }}</span>
              </div>
              <span v-if="overlayDisplay.show_percent" class="overlay-metric-value overlay-glow-pink">
                {{ diskPercentLabel(disk) }}
              </span>
            </div>
          </div>
          <div class="overlay-progress">
            <span
              class="overlay-progress-fill overlay-progress-fill--pink"
              :style="{ width: `${disk.usage_pct}%` }"></span>
          </div>
        </div>
      </template>
    </div>

    <div class="overlay-divider"></div>

    <footer class="overlay-network">
      <div v-if="prefs.showDown" class="overlay-network-item">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">download</span>
          <span>{{ t('overlay.down') }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ downloadSpeed }}
          <span>MB/s</span>
        </div>
      </div>
      <div v-if="prefs.showUp" class="overlay-network-item">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">upload</span>
          <span>{{ t('overlay.up') }}</span>
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
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';
import packageJson from '../../package.json';

const OVERLAY_PREF_KEY = 'pulsecore.overlay_prefs';
const OVERLAY_POS_KEY = 'pulsecore.overlay_pos';

interface OverlayPrefs {
  showCpu: boolean;
  showGpu: boolean;
  showMemory: boolean;
  showDisk: boolean;
  showDown: boolean;
  showUp: boolean;
}

const { t } = useI18n();
const store = useAppStore();
const appVersion = packageJson.version;
const snapshot = computed(() => store.snapshot);
const overlayDisplay = computed(() => store.settings.overlay_display);
const showConfig = ref(false);
const startedAt = Date.now();
const uptimeLabel = ref('00:00:00');
let uptimeTimer: number | undefined;
const overlayRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let resizeFrame: number | undefined;
let lastSize = { width: 0, height: 0 };
let windowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;
let moveUnlisten: (() => void) | undefined;
let moveFrame: number | undefined;
let lastPosition = { x: 0, y: 0 };

const cpuUsagePct = computed(() => snapshot.value.cpu.usage_pct);
const gpuUsagePct = computed(() => snapshot.value.gpu.usage_pct ?? 0);
const memoryUsagePct = computed(() => snapshot.value.memory.usage_pct);
const disks = computed(() => snapshot.value.disks);
const cpuPercentLabel = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(1)}%`);
const gpuPercentLabel = computed(() =>
  snapshot.value.gpu.usage_pct == null ? t('common.na') : `${snapshot.value.gpu.usage_pct.toFixed(1)}%`
);
const memoryPercentLabel = computed(() => `${snapshot.value.memory.usage_pct.toFixed(1)}%`);
const cpuDetailLabel = computed(() => {
  const parts: string[] = [];
  const freq = snapshot.value.cpu.frequency_mhz;
  const maxFreq = store.hardwareInfo.cpu_max_freq_mhz;

  if (freq && maxFreq) {
    parts.push(`${(freq / 1000).toFixed(1)}/${(maxFreq / 1000).toFixed(1)}GHz`);
  } else if (freq) {
    parts.push(`${(freq / 1000).toFixed(1)}GHz`);
  }

  if (snapshot.value.cpu.temperature_c) {
    parts.push(`${snapshot.value.cpu.temperature_c.toFixed(0)}°C`);
  }
  return parts.length > 0 ? parts.join(' · ') : t('common.na');
});
const gpuDetailLabel = computed(() => {
  const parts: string[] = [];
  if (snapshot.value.gpu.memory_used_mb != null && snapshot.value.gpu.memory_total_mb != null) {
    parts.push(
      `${t('overlay.vram')} ${snapshot.value.gpu.memory_used_mb.toFixed(0)}/${snapshot.value.gpu.memory_total_mb.toFixed(0)} MB`
    );
  }
  if (snapshot.value.gpu.frequency_mhz != null) {
    parts.push(`${t('overlay.freq')} ${formatGpuFreq(snapshot.value.gpu.frequency_mhz)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : t('common.na');
});
const memoryUsageLabel = computed(() => {
  const used = (snapshot.value.memory.used_mb / 1024).toFixed(1);
  const total = (snapshot.value.memory.total_mb / 1024).toFixed(0);
  return `${used}/${total} GB`;
});
const downloadSpeed = computed(() => (snapshot.value.network.download_bytes_per_sec / 1024 / 1024).toFixed(2));
const uploadSpeed = computed(() => (snapshot.value.network.upload_bytes_per_sec / 1024 / 1024).toFixed(2));
const hardwareInfoLabel = computed(() => {
  const parts = [
    store.hardwareInfo.device_brand,
    store.hardwareInfo.cpu_model,
    store.hardwareInfo.gpu_model
  ].filter(part => part && part.trim().length > 0);
  return parts.length > 0 ? parts.join(' · ') : t('common.na');
});

const prefs = reactive<OverlayPrefs>(loadPrefs());

watch(
  prefs,
  next => {
    localStorage.setItem(OVERLAY_PREF_KEY, JSON.stringify(next));
  },
  { deep: true }
);

function loadPrefs(): OverlayPrefs {
  const fallback: OverlayPrefs = {
    showCpu: true,
    showGpu: true,
    showMemory: true,
    showDisk: true,
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
      showDisk: parsed.showDisk ?? fallback.showDisk,
      showDown: parsed.showDown ?? fallback.showDown,
      showUp: parsed.showUp ?? fallback.showUp
    };
  } catch {
    return fallback;
  }
}

function loadPosition() {
  try {
    const raw = localStorage.getItem(OVERLAY_POS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function savePosition(next: { x: number; y: number }) {
  if (next.x === lastPosition.x && next.y === lastPosition.y) {
    return;
  }
  lastPosition = next;
  localStorage.setItem(OVERLAY_POS_KEY, JSON.stringify(next));
}

function hide() {
  void store.toggleOverlay(false);
}

async function startDragging() {
  if (!inTauri()) {
    return;
  }
  const { getCurrentWindow } = await getWindowApi();
  await getCurrentWindow().startDragging();
}

async function getWindowApi() {
  if (!windowApiPromise) {
    windowApiPromise = import('@tauri-apps/api/window');
  }
  return windowApiPromise;
}

async function applyWindowSize(width: number, height: number) {
  if (!inTauri()) {
    return;
  }
  const nextWidth = Math.max(1, Math.ceil(width));
  const nextHeight = Math.max(1, Math.ceil(height));
  if (nextWidth === lastSize.width && nextHeight === lastSize.height) {
    return;
  }
  lastSize = { width: nextWidth, height: nextHeight };
  const { getCurrentWindow, LogicalSize } = await getWindowApi();
  await getCurrentWindow().setSize(new LogicalSize(nextWidth, nextHeight));
}

async function restorePosition() {
  const saved = loadPosition();
  if (!saved) {
    return;
  }
  const { getCurrentWindow, LogicalPosition } = await getWindowApi();
  await getCurrentWindow().setPosition(new LogicalPosition(saved.x, saved.y));
}

function schedulePositionSave() {
  if (moveFrame != null) {
    return;
  }
  moveFrame = window.requestAnimationFrame(async () => {
    moveFrame = undefined;
    const { getCurrentWindow } = await getWindowApi();
    const pos = await getCurrentWindow().outerPosition();
    savePosition({ x: pos.x, y: pos.y });
  });
}

function scheduleResize() {
  if (resizeFrame != null) {
    return;
  }
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = undefined;
    const element = overlayRef.value;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    void applyWindowSize(rect.width, rect.height);
  });
}

function formatUptime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function updateUptime() {
  uptimeLabel.value = formatUptime(Date.now() - startedAt);
}

function formatGpuFreq(value: number) {
  if (!Number.isFinite(value)) {
    return t('common.na');
  }
  return `${(value / 1000).toFixed(2)} GHz`;
}

function diskUsageLabel(disk: { used_gb: number; total_gb: number }) {
  return `${disk.used_gb.toFixed(0)}/${disk.total_gb.toFixed(0)} GB`;
}

function diskPercentLabel(disk: { usage_pct: number }) {
  return `${disk.usage_pct.toFixed(1)}%`;
}

function diskIoLabel(disk: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) {
  const read = ((disk.read_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
  const write = ((disk.write_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
  return `R: ${read} MB/s · W: ${write} MB/s`;
}

onMounted(() => {
  updateUptime();
  uptimeTimer = window.setInterval(updateUptime, 1000);
  if (!inTauri()) {
    return;
  }
  void restorePosition();
  void getWindowApi()
    .then(({ getCurrentWindow }) =>
      getCurrentWindow().onMoved(() => {
        schedulePositionSave();
      })
    )
    .then(unlisten => {
      moveUnlisten = unlisten;
    });
  const element = overlayRef.value;
  if (!element || typeof ResizeObserver === 'undefined') {
    return;
  }
  resizeObserver = new ResizeObserver(() => {
    scheduleResize();
  });
  resizeObserver.observe(element);
  scheduleResize();
});
onUnmounted(() => {
  if (uptimeTimer) {
    window.clearInterval(uptimeTimer);
  }
  if (resizeObserver && overlayRef.value) {
    resizeObserver.unobserve(overlayRef.value);
  }
  resizeObserver = undefined;
  if (resizeFrame != null) {
    window.cancelAnimationFrame(resizeFrame);
  }
  if (moveUnlisten) {
    moveUnlisten();
  }
  moveUnlisten = undefined;
  if (moveFrame != null) {
    window.cancelAnimationFrame(moveFrame);
  }
});
</script>
