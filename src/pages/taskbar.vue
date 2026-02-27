<template>
  <section
    ref="barRef"
    class="taskbar-bar"
    :class="{ 'taskbar-bar--two-line': prefs.twoLineMode }"
    role="presentation"
    @mousedown="handleMouseDown"
    @dblclick.prevent.stop="showMainWindow"
    @contextmenu.prevent.stop="handleContextMenu">
    <div v-if="prefs.twoLineMode" class="taskbar-grid" :style="{ '--taskbar-cols': String(twoLineCols) }">
      <div
        v-for="(seg, idx) in twoLineCells"
        :key="seg?.id ?? `empty_${idx}`"
        class="taskbar-cell"
        :class="{ 'taskbar-cell--empty': !seg }">
        <template v-if="seg">
          <span class="taskbar-k" :class="{ 'taskbar-k--icon': seg.labelIcon }">
            <span v-if="seg.labelIcon" class="material-symbols-outlined taskbar-icon">{{ seg.labelIcon }}</span>
            <span v-else>{{ seg.label }}</span>
          </span>
          <span class="taskbar-v" :class="seg.valueClass" :style="fixedTextWidth(seg.valueWidthCh)">
            {{ seg.value }}
          </span>
          <span v-if="seg.extra" class="taskbar-extra" :style="fixedTextWidth(seg.extraWidthCh)">
            {{ seg.extra }}
          </span>
        </template>
      </div>
    </div>
    <div v-else class="taskbar-row">
      <template v-for="(seg, idx) in segments" :key="seg.id">
        <span v-if="idx > 0" class="taskbar-sep">|</span>
        <span class="taskbar-seg">
          <span class="taskbar-k" :class="{ 'taskbar-k--icon': seg.labelIcon }">
            <span v-if="seg.labelIcon" class="material-symbols-outlined taskbar-icon">{{ seg.labelIcon }}</span>
            <span v-else>{{ seg.label }}</span>
          </span>
          <span class="taskbar-v" :class="seg.valueClass" :style="fixedTextWidth(seg.valueWidthCh)">
            {{ seg.value }}
          </span>
          <span v-if="seg.extra" class="taskbar-extra" :style="fixedTextWidth(seg.extraWidthCh)">
            {{ seg.extra }}
          </span>
        </span>
      </template>
    </div>
  </section>
  <TaskbarContextMenu
    ref="contextMenuRef"
    :always-on-top="alwaysOnTop"
    :auto-hide-on-fullscreen="autoHideOnFullscreen"
    :remember-position="rememberPosition"
    :prefs="prefs"
    :show-main-window="showMainWindow"
    :hide-main-window="hideMainWindow"
    :apply-taskbar-topmost="applyTaskbarTopmost"
    :pause-topmost-guard="pauseTopmostGuard"
    :resume-topmost-guard="resumeTopmostGuard" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useTaskbarPrefs } from '../composables/useTaskbarPrefs';
import { useTaskbarWindow } from '../composables/useTaskbarWindow';
import { api, inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';
import TaskbarContextMenu from '../components/TaskbarContextMenu.vue';

const store = useAppStore();
const { t } = useI18n();
const { prefs } = useTaskbarPrefs();

const rememberPosition = computed(() => store.settings.rememberOverlayPosition);
const alwaysOnTop = computed(() => store.settings.taskbarAlwaysOnTop);
const autoHideOnFullscreen = computed(() => store.settings.taskbarAutoHideOnFullscreen);
const { barRef, handleMouseDown, scheduleResize } = useTaskbarWindow({ rememberPosition });
const contextMenuRef = ref<{ open: (event: MouseEvent) => void } | null>(null);

const snapshot = computed(() => store.snapshot);

const cpuPct = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(0)}%`);
const cpuFreq = computed(() => {
  const freq = snapshot.value.cpu.frequency_mhz;
  if (!freq) return null;
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}GHz`;
  return `${freq.toFixed(0)}MHz`;
});
const cpuTemp = computed(() => {
  const temp = snapshot.value.cpu.temperature_c;
  if (temp == null) return null;
  return `${temp.toFixed(0)}°C`;
});

const gpuPct = computed(() => {
  const pct = snapshot.value.gpu.usage_pct ?? 0;
  return `${pct.toFixed(0)}%`;
});
const gpuTemp = computed(() => {
  const temp = snapshot.value.gpu.temperature_c;
  if (temp == null) return null;
  return `${temp.toFixed(0)}°C`;
});

const memPct = computed(() => `${snapshot.value.memory.usage_pct.toFixed(0)}%`);
const memUsage = computed(() => {
  const used = snapshot.value.memory.used_mb / 1024;
  const total = snapshot.value.memory.total_mb / 1024;
  return `${used.toFixed(1)}/${total.toFixed(0)}GB`;
});

const down = computed(() => (snapshot.value.network.download_bytes_per_sec / 1024 / 1024).toFixed(1));
const up = computed(() => (snapshot.value.network.upload_bytes_per_sec / 1024 / 1024).toFixed(1));
const latency = computed(() => {
  const value = snapshot.value.network.latency_ms;
  return value == null ? null : `${value.toFixed(0)}ms`;
});

const appCpuPct = computed(() => {
  const value = snapshot.value.appCpuUsagePct ?? 0;
  return `${value.toFixed(1)}%`;
});
const appMem = computed(() => {
  const value = snapshot.value.appMemoryMb;
  return value == null ? null : `${value.toFixed(0)}MB`;
});

function usageClass(value: number, base: 'cyan' | 'pink') {
  if (value > 85) return 'overlay-glow-red';
  if (value > 75) return 'overlay-glow-orange';
  return base === 'cyan' ? 'overlay-glow-cyan' : 'overlay-glow-pink';
}

type Segment = {
  id: string;
  label: string;
  labelIcon?: string;
  value: string;
  extra?: string;
  valueClass?: string;
};
type SegmentWidthPreset = { valueWidthCh: number; extraWidthCh?: number };

const SEGMENT_WIDTH_PRESETS: Record<string, SegmentWidthPreset> = {
  cpu: { valueWidthCh: 4, extraWidthCh: 5 },
  gpu: { valueWidthCh: 4, extraWidthCh: 5 },
  ram: { valueWidthCh: 4 },
  app: { valueWidthCh: 4, extraWidthCh: 8 },
  down: { valueWidthCh: 6, extraWidthCh: 4 },
  up: { valueWidthCh: 6, extraWidthCh: 4 },
  lat: { valueWidthCh: 6 }
};

type SizedSegment = Segment & SegmentWidthPreset;

function createSegment(segment: Segment): SizedSegment {
  const preset = SEGMENT_WIDTH_PRESETS[segment.id] ?? { valueWidthCh: 4 };
  return {
    ...segment,
    ...preset
  };
}

function fixedTextWidth(widthCh?: number) {
  if (!widthCh) return undefined;
  return { width: `${widthCh}ch` };
}

const segments = computed<SizedSegment[]>(() => {
  const parts: SizedSegment[] = [];

  if (prefs.showCpu) {
    const extras: string[] = [];
    if (prefs.showCpuFreq && cpuFreq.value) extras.push(cpuFreq.value);
    if (prefs.showCpuTemp && cpuTemp.value) extras.push(cpuTemp.value);
    parts.push(
      createSegment({
        id: 'cpu',
        label: 'CPU',
        value: cpuPct.value,
        extra: extras.length > 0 ? extras.join(' ') : undefined,
        valueClass: usageClass(snapshot.value.cpu.usage_pct, 'cyan')
      })
    );
  }

  if (prefs.showGpu) {
    const value = gpuPct.value;
    const extras: string[] = [];
    if (prefs.showGpuTemp && gpuTemp.value) extras.push(gpuTemp.value);
    parts.push(
      createSegment({
        id: 'gpu',
        label: 'GPU',
        value,
        extra: extras.length > 0 ? extras.join(' ') : undefined,
        valueClass: usageClass(snapshot.value.gpu.usage_pct ?? 0, 'pink')
      })
    );
  }

  if (prefs.showMemory) {
    parts.push(
      createSegment({
        id: 'ram',
        label: 'RAM',
        value: memPct.value
        // extra: memUsage.value
      })
    );
  }

  if (prefs.showApp && (appCpuPct.value || appMem.value)) {
    parts.push(
      createSegment({
        id: 'app',
        label: 'APP',
        value: appCpuPct.value,
        extra: appMem.value ?? undefined,
        valueClass: 'overlay-glow-cyan'
      })
    );
  }

  if (prefs.showDown) {
    parts.push(
      createSegment({
        id: 'down',
        label: t('overlay.down'),
        labelIcon: 'arrow_downward',
        value: down.value,
        extra: 'MB/s'
      })
    );
  }

  if (prefs.showUp) {
    parts.push(
      createSegment({
        id: 'up',
        label: t('overlay.up'),
        labelIcon: 'arrow_upward',
        value: up.value,
        extra: 'MB/s'
      })
    );
  }

  if (prefs.showLatency) {
    parts.push(createSegment({ id: 'lat', label: 'L', value: latency.value ?? t('common.na') }));
  }

  return parts;
});

const twoLineCols = computed(() => Math.max(1, Math.ceil(segments.value.length / 2)));
const twoLineCells = computed(() => {
  const cols = twoLineCols.value;
  const list = segments.value;
  const cells: Array<SizedSegment | null> = Array.from({ length: cols * 2 }, () => null);
  for (let i = 0; i < Math.min(list.length, cells.length); i++) {
    cells[i] = list[i];
  }
  return cells;
});

async function showMainWindow() {
  await store.ensureMainWindow();
}

async function hideMainWindow() {
  await store.closeMainWindow();
}

function handleContextMenu(event: MouseEvent) {
  contextMenuRef.value?.open(event);
}

async function applyTaskbarTopmost(enabled: boolean) {
  if (!inTauri()) {
    return;
  }
  try {
    await api.setWindowSystemTopmost('taskbar', enabled);
  } catch {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setAlwaysOnTop(enabled);
    } catch {
      // ignore
    }
  }
}

let topmostRepairTimer: number | null = null;
let topmostHeartbeatTimer: number | null = null;
let unlistenFocusChanged: (() => void) | null = null;
let topmostGuardPauseDepth = 0;

function isTopmostGuardPaused() {
  return topmostGuardPauseDepth > 0;
}

function pauseTopmostGuard() {
  topmostGuardPauseDepth += 1;
  stopTopmostGuard();
}

function resumeTopmostGuard() {
  if (topmostGuardPauseDepth === 0) return;
  topmostGuardPauseDepth -= 1;
  if (topmostGuardPauseDepth === 0 && alwaysOnTop.value) {
    void startTopmostGuard();
  }
}

function clearTopmostRepairTimer() {
  if (topmostRepairTimer != null) {
    window.clearTimeout(topmostRepairTimer);
    topmostRepairTimer = null;
  }
}

function scheduleTopmostRepair(delayMs = 0) {
  if (!inTauri() || !alwaysOnTop.value || isTopmostGuardPaused()) {
    return;
  }
  clearTopmostRepairTimer();
  topmostRepairTimer = window.setTimeout(() => {
    topmostRepairTimer = null;
    void applyTaskbarTopmost(true);
  }, delayMs);
}

async function startTopmostGuard() {
  if (!inTauri() || isTopmostGuardPaused()) {
    return;
  }
  scheduleTopmostRepair(0);
  if (topmostHeartbeatTimer == null) {
    // Keep the monitor on the front of the TOPMOST band.
    topmostHeartbeatTimer = window.setInterval(() => {
      scheduleTopmostRepair(0);
    }, 1500);
  }
  if (!unlistenFocusChanged) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      unlistenFocusChanged = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          scheduleTopmostRepair(60);
        }
      });
    } catch {
      // ignore
    }
  }
}

function stopTopmostGuard() {
  clearTopmostRepairTimer();
  if (topmostHeartbeatTimer != null) {
    window.clearInterval(topmostHeartbeatTimer);
    topmostHeartbeatTimer = null;
  }
  if (unlistenFocusChanged) {
    unlistenFocusChanged();
    unlistenFocusChanged = null;
  }
}

async function syncTaskbarHeightVar() {
  if (!inTauri() || typeof document === 'undefined') {
    return;
  }
  try {
    const [{ primaryMonitor }] = await Promise.all([import('@tauri-apps/api/window')]);
    const monitor = await primaryMonitor();
    const scale = monitor?.scaleFactor ?? 1;
    const info = await api.getTaskbarInfo();
    const taskbarHeightPx = info ? Math.abs(info.bottom - info.top) : 48;
    const height = Math.max(24, Math.round(taskbarHeightPx / scale));
    document.documentElement.style.setProperty('--taskbar-height', `${height}px`);
    scheduleResize();
  } catch {
    // ignore
  }
}

onMounted(() => {
  void syncTaskbarHeightVar();
});

onUnmounted(() => {
  stopTopmostGuard();
});

watch(
  alwaysOnTop,
  enabled => {
    if (!inTauri()) return;
    void applyTaskbarTopmost(enabled);
    if (enabled) {
      void startTopmostGuard();
    } else {
      stopTopmostGuard();
    }
  },
  { immediate: true }
);
</script>
