<template>
  <section
    ref="overlayRef"
    class="overlay-widget overlay-widget--cyber"
    @dblclick.prevent.stop
    @mousedown="handleOverlayMouseDown">
    <header>
      <div class="overlay-title">
        <div class="badge">
          {{ t('overlay.badge') }}
        </div>
        <span>
          <span class="title">{{ t('overlay.title') }}</span>
          <!-- <span class="version">v{{ appVersion }}</span> -->
        </span>
      </div>
      <div class="overlay-header-actions">
        <div v-if="prefs.showDragHandle" class="overlay-drag" @mousedown.stop="startDragging">
          <span class="material-symbols-outlined">drag_handle</span>
        </div>
        <button
          class="overlay-action overlay-action--info"
          type="button"
          @mousedown.stop
          @click="minimizeOverlay"
          :title="t('overlay.minimizeToTray')">
          <span class="material-symbols-outlined">remove</span>
        </button>
        <button
          class="overlay-action overlay-action--primary"
          type="button"
          @mousedown.stop
          @click="showConfig = !showConfig"
          :title="t('overlay.configure')">
          <span class="material-symbols-outlined">settings</span>
        </button>
        <button
          class="overlay-action overlay-action--danger"
          type="button"
          @mousedown.stop
          @click="handleClose"
          :title="t('overlay.close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <Transition name="slide">
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
        <label>
          <input v-model="prefs.showLatency" type="checkbox" />
          {{ t('overlay.showLatency') }}
        </label>
        <label>
          <input v-model="prefs.showValues" type="checkbox" />
          {{ t('overlay.showValues') }}
        </label>
        <label>
          <input v-model="prefs.showPercent" type="checkbox" />
          {{ t('overlay.showPercent') }}
        </label>
        <label>
          <input v-model="prefs.showHardwareInfo" type="checkbox" />
          {{ t('overlay.showHardware') }}
        </label>
        <label>
          <input v-model="prefs.showWarning" type="checkbox" />
          {{ t('overlay.showWarning') }}
        </label>
        <label>
          <input v-model="prefs.showDragHandle" type="checkbox" />
          {{ t('overlay.showDragHandle') }}
        </label>
        <label>
          <input v-model="closeToTray" type="checkbox" />
          {{ t('overlay.closeToTray') }}
        </label>
        <div class="overlay-config-language">
          <span class="overlay-config-label">{{ t('overlay.language') }}</span>
          <div class="overlay-lang-buttons">
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': store.settings.language === 'zh-CN' }"
              @click="setLanguage('zh-CN')">
              {{ t('overlay.langZh') }}
            </button>
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': store.settings.language === 'en-US' }"
              @click="setLanguage('en-US')">
              {{ t('overlay.langEn') }}
            </button>
          </div>
        </div>
        <div class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.refreshRate') }}</span>
          <span class="overlay-config-value">{{ refreshRate }}ms</span>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            v-model.number="refreshRate"
            @change="handleRefreshRateChange" />
        </div>
        <div class="overlay-config-version">v{{ appVersion }}</div>
      </div>
    </Transition>

    <div class="overlay-metrics">
      <div v-if="prefs.showCpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory</span>
            <div class="overlay-metric-text">
              <span class="overlay-metric-name">{{ t('overlay.cpu') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ cpuDetailLabel }}</span>
              <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">{{ cpuHardwareLabel }}</span>
            </div>
          </div>
          <span v-if="prefs.showPercent" class="overlay-metric-value" :class="getUsageClass(cpuUsagePct, 'cyan')">
            {{ cpuPercentLabel }}
          </span>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill"
            :class="getProgressClass(cpuUsagePct, 'cyan')"
            :style="{ width: `${cpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showGpu" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--gpu">developer_board</span>
            <div class="overlay-metric-text">
              <span class="overlay-metric-name">{{ t('overlay.gpu') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ gpuDetailLabel }}</span>
              <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">{{ gpuHardwareLabel }}</span>
            </div>
          </div>
          <span v-if="prefs.showPercent" class="overlay-metric-value" :class="getUsageClass(gpuUsagePct, 'pink')">
            {{ gpuPercentLabel }}
          </span>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill"
            :class="getProgressClass(gpuUsagePct, 'pink')"
            :style="{ width: `${gpuUsagePct}%` }"></span>
        </div>
      </div>

      <div v-if="prefs.showMemory" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory_alt</span>
            <div class="overlay-metric-text">
              <span class="overlay-metric-name">{{ t('overlay.memory') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ memoryUsageLabel }}</span>
              <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">{{ memoryHardwareLabel }}</span>
            </div>
          </div>
          <span
            v-if="prefs.showPercent"
            class="overlay-metric-value"
            :class="getUsageClass(memoryUsagePct, 'cyan')">
            {{ memoryPercentLabel }}
          </span>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill"
            :class="getProgressClass(memoryUsagePct, 'cyan')"
            :style="{ width: `${memoryUsagePct}%` }"></span>
        </div>
      </div>

      <template v-if="prefs.showDisk">
        <div v-for="disk in disks" :key="disk.name" class="overlay-metric">
          <div class="overlay-metric-top">
            <div class="overlay-metric-label">
              <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">hard_drive</span>
              <div class="overlay-metric-text">
                <span class="overlay-metric-name">{{ disk.name }}</span>
                <div v-if="prefs.showValues">
                  <span class="overlay-metric-detail">{{ diskUsageLabel(disk) }}</span>
                  <span class="overlay-metric-io" style="margin-left: 8px">{{ diskIoLabel(disk) }}</span>
                </div>
                <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">
                  {{ getDiskHardwareLabel(disk) }}
                </span>
              </div>
            </div>
            <span
              v-if="prefs.showPercent"
              class="overlay-metric-value"
              :class="getUsageClass(disk.usage_pct, 'pink')">
              {{ diskPercentLabel(disk) }}
            </span>
          </div>
          <div class="overlay-progress">
            <span
              class="overlay-progress-fill"
              :class="getProgressClass(disk.usage_pct, 'pink')"
              :style="{ width: `${disk.usage_pct}%` }"></span>
          </div>
        </div>
      </template>
    </div>

    <div class="overlay-divider"></div>

    <footer class="overlay-network">
      <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showUp }">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">upload</span>
          <span>{{ t('overlay.up') }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ uploadSpeed }}
          <span>MB/s</span>
        </div>
      </div>
      <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showLatency }">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">network_ping</span>
          <span>{{ t('overlay.latency') }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ latencyLabel }}
        </div>
      </div>
      <div class="overlay-network-item" :class="{ 'overlay-network-item--hidden': !prefs.showDown }">
        <div class="overlay-network-label">
          <span class="material-symbols-outlined">download</span>
          <span>{{ t('overlay.down') }}</span>
        </div>
        <div class="overlay-network-value overlay-glow-cyan">
          {{ downloadSpeed }}
          <span>MB/s</span>
        </div>
      </div>
    </footer>

    <div class="overlay-status">
      <div class="overlay-status-left">
        <span class="overlay-status-dot"></span>
        <span>SYSTEM STABLE</span>
      </div>
      <span class="overlay-status-uptime">Uptime: {{ uptimeLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';
import packageJson from '../../package.json';

const OVERLAY_PREF_KEY = 'pulsecorelite.overlay_prefs';
const OVERLAY_POS_KEY = 'pulsecorelite.overlay_pos';

interface OverlayPrefs {
  showCpu: boolean;
  showGpu: boolean;
  showMemory: boolean;
  showDisk: boolean;
  showDown: boolean;
  showUp: boolean;
  showLatency: boolean;
  showValues: boolean;
  showPercent: boolean;
  showHardwareInfo: boolean;
  showWarning: boolean;
  showDragHandle: boolean;
}

const { t } = useI18n();
const store = useAppStore();
const appVersion = packageJson.version;
const snapshot = computed(() => store.snapshot);
const showConfig = ref(false);
const closeToTray = computed({
  get: () => store.settings.closeToTray,
  set: value => store.setCloseToTray(value)
});
const startedAt = Date.now();
const uptimeLabel = ref('00:00:00');
const refreshRate = ref(1000);
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
const latencyLabel = computed(() => {
  const value = snapshot.value.network.latency_ms ?? null;
  return value == null ? t('common.na') : `${value.toFixed(0)} ms`;
});
const cpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.cpu_model]));
const gpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.gpu_model]));
const memoryHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.ram_spec]));

const prefs = reactive<OverlayPrefs>(loadPrefs());

function handleRefreshRateChange() {
  store.setRefreshRate(refreshRate.value);
  localStorage.setItem('pulsecorelite.refresh_rate', String(refreshRate.value));
}

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
    showUp: true,
    showLatency: true,
    showValues: true,
    showPercent: true,
    showHardwareInfo: false,
    showWarning: true,
    showDragHandle: false
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
      showUp: parsed.showUp ?? fallback.showUp,
      showLatency: parsed.showLatency ?? fallback.showLatency,
      showValues: parsed.showValues ?? fallback.showValues,
      showPercent: parsed.showPercent ?? fallback.showPercent,
      showHardwareInfo: parsed.showHardwareInfo ?? fallback.showHardwareInfo,
      showWarning: parsed.showWarning ?? fallback.showWarning,
      showDragHandle: parsed.showDragHandle ?? fallback.showDragHandle
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

function handleClose() {
  if (store.settings.closeToTray) {
    void store.minimizeToTray();
    return;
  }
  void store.exitApp();
}

function minimizeOverlay() {
  void store.minimizeOverlay();
}

function setLanguage(language: 'zh-CN' | 'en-US') {
  store.setLanguage(language);
}

async function startDragging() {
  if (!inTauri()) {
    return;
  }
  const { getCurrentWindow } = await getWindowApi();
  await getCurrentWindow().startDragging();
}

function handleOverlayMouseDown(event: MouseEvent) {
  if (prefs.showDragHandle) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  if (target.closest('.overlay-header-actions')) {
    return;
  }
  if (target.closest('button, input, select, textarea, label, .overlay-config')) {
    return;
  }
  void startDragging();
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

function normalizeHardwareModel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const segments = trimmed
    .split(' / ')
    .map(part => part.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : trimmed;
}

function formatHardwareLabel(parts: Array<string | null | undefined>) {
  const cleaned = parts
    .filter(part => part && part.trim().length > 0)
    .map(part => normalizeHardwareModel(part as string))
    .filter(part => part.length > 0);
  return cleaned.length > 0 ? cleaned.join(' · ') : t('common.na');
}

function getUsageClass(value: number, baseColor: 'cyan' | 'pink') {
  if (!prefs.showWarning) {
    return `overlay-glow-${baseColor}`;
  }
  if (value > 85) {
    return 'overlay-glow-red';
  }
  if (value > 75) {
    return 'overlay-glow-orange';
  }
  return `overlay-glow-${baseColor}`;
}

function getProgressClass(value: number, baseColor: 'cyan' | 'pink') {
  if (!prefs.showWarning) {
    return `overlay-progress-fill--${baseColor}`;
  }
  if (value > 85) {
    return 'overlay-progress-fill--red';
  }
  if (value > 75) {
    return 'overlay-progress-fill--orange';
  }
  return `overlay-progress-fill--${baseColor}`;
}

function getDiskHardwareLabel(disk: { name: string; total_gb: number }) {
  const mountPoint = disk.name;
  const driveLetter = mountPoint.replace(/[\\/]$/, '');
  const match = store.hardwareInfo.disk_models.find(
    modelStr => modelStr.startsWith(driveLetter + ' ') || modelStr.startsWith(driveLetter + '·')
  );

  let modelName = t('common.na');

  if (match) {
    // match is "C: · Model Name", we want "Model Name"
    const parts = match.split('·');
    if (parts.length > 1) {
      const rawModel = parts.slice(1).join('·');
      modelName = normalizeHardwareModel(rawModel);
    } else {
      modelName = normalizeHardwareModel(match);
    }
  }

  return `${modelName} · ${disk.total_gb.toFixed(0)} GB`;
}

onMounted(() => {
  updateUptime();
  uptimeTimer = window.setInterval(updateUptime, 1000);

  const storedRate = localStorage.getItem('pulsecorelite.refresh_rate');
  if (storedRate) {
    refreshRate.value = Number(storedRate);
    store.setRefreshRate(refreshRate.value);
  }

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
