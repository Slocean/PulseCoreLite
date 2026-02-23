<template>
  <section
    ref="barRef"
    class="taskbar-bar"
    :class="{ 'taskbar-bar--two-line': prefs.twoLineMode }"
    role="presentation"
    @mousedown="handleMouseDown"
    @dblclick.prevent.stop="showMainWindow"
    @contextmenu.prevent.stop="openContextMenu">
    <div v-if="prefs.twoLineMode" class="taskbar-grid" :style="{ '--taskbar-cols': String(twoLineCols) }">
      <div
        v-for="(seg, idx) in twoLineCells"
        :key="seg?.id ?? `empty_${idx}`"
        class="taskbar-cell"
        :class="{ 'taskbar-cell--empty': !seg }">
        <template v-if="seg">
          <span class="taskbar-k">{{ seg.label }}</span>
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
          <span class="taskbar-k">{{ seg.label }}</span>
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
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useTaskbarPrefs } from '../composables/useTaskbarPrefs';
import { useTaskbarWindow } from '../composables/useTaskbarWindow';
import { api, inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { t } = useI18n();
const { prefs } = useTaskbarPrefs();

const rememberPosition = computed(() => store.settings.rememberOverlayPosition);
const alwaysOnTop = computed(() => store.settings.taskbarAlwaysOnTop);
const { barRef, handleMouseDown, scheduleResize } = useTaskbarWindow({ rememberPosition });

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
  const pct = snapshot.value.gpu.usage_pct;
  return pct == null ? null : `${pct.toFixed(0)}%`;
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
  const value = snapshot.value.appCpuUsagePct;
  return value == null ? null : `${value.toFixed(1)}%`;
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

type Segment = { id: string; label: string; value: string; extra?: string; valueClass?: string };
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
    const value = gpuPct.value ?? t('common.na');
    const extras: string[] = [];
    if (prefs.showGpuTemp && gpuTemp.value) extras.push(gpuTemp.value);
    parts.push(
      createSegment({
        id: 'gpu',
        label: 'GPU',
        value,
        extra: extras.length > 0 ? extras.join(' ') : undefined,
        valueClass: snapshot.value.gpu.usage_pct == null ? '' : usageClass(snapshot.value.gpu.usage_pct, 'pink')
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
        value: appCpuPct.value ?? t('common.na'),
        extra: appMem.value ?? undefined,
        valueClass: 'overlay-glow-cyan'
      })
    );
  }

  if (prefs.showDown) {
    parts.push(createSegment({ id: 'down', label: 'D', value: down.value, extra: 'MB/s' }));
  }

  if (prefs.showUp) {
    parts.push(createSegment({ id: 'up', label: 'U', value: up.value, extra: 'MB/s' }));
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
  await store.toggleOverlay(true);
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

function clearTopmostRepairTimer() {
  if (topmostRepairTimer != null) {
    window.clearTimeout(topmostRepairTimer);
    topmostRepairTimer = null;
  }
}

function scheduleTopmostRepair(delayMs = 0) {
  if (!inTauri() || !alwaysOnTop.value) {
    return;
  }
  clearTopmostRepairTimer();
  topmostRepairTimer = window.setTimeout(() => {
    topmostRepairTimer = null;
    void applyTaskbarTopmost(true);
  }, delayMs);
}

async function startTopmostGuard() {
  if (!inTauri()) {
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

async function openContextMenu(event: MouseEvent) {
  if (!inTauri()) {
    return;
  }

  const [{ Menu, CheckMenuItem, MenuItem, PredefinedMenuItem }, { LogicalPosition }, { getCurrentWindow }] =
    await Promise.all([
      import('@tauri-apps/api/menu'),
      import('@tauri-apps/api/dpi'),
      import('@tauri-apps/api/window')
    ]);

  const items = [
    await MenuItem.new({
      text: t('overlay.openMainWindow'),
      action: () => void showMainWindow()
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await CheckMenuItem.new({
      text: t('overlay.alwaysOnTop'),
      checked: alwaysOnTop.value,
      action: async () => {
        const next = !alwaysOnTop.value;
        store.setTaskbarAlwaysOnTop(next);
        await applyTaskbarTopmost(next);
      }
    }),
    await CheckMenuItem.new({
      text: t('overlay.rememberPosition'),
      checked: rememberPosition.value,
      action: () => store.setRememberOverlayPosition(!rememberPosition.value)
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await CheckMenuItem.new({
      text: t('overlay.taskbarTwoLine'),
      checked: prefs.twoLineMode,
      action: () => (prefs.twoLineMode = !prefs.twoLineMode)
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await CheckMenuItem.new({
      text: t('overlay.cpu'),
      checked: prefs.showCpu,
      action: () => (prefs.showCpu = !prefs.showCpu)
    }),
    await CheckMenuItem.new({
      text: t('overlay.cpuFreq'),
      checked: prefs.showCpuFreq,
      enabled: prefs.showCpu,
      action: () => (prefs.showCpuFreq = !prefs.showCpuFreq)
    }),
    await CheckMenuItem.new({
      text: t('overlay.cpuTemp'),
      checked: prefs.showCpuTemp,
      enabled: prefs.showCpu,
      action: () => (prefs.showCpuTemp = !prefs.showCpuTemp)
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await CheckMenuItem.new({
      text: t('overlay.gpu'),
      checked: prefs.showGpu,
      action: () => (prefs.showGpu = !prefs.showGpu)
    }),
    await CheckMenuItem.new({
      text: t('overlay.gpuTemp'),
      checked: prefs.showGpuTemp,
      enabled: prefs.showGpu,
      action: () => (prefs.showGpuTemp = !prefs.showGpuTemp)
    }),
    await CheckMenuItem.new({
      text: t('overlay.memory'),
      checked: prefs.showMemory,
      action: () => (prefs.showMemory = !prefs.showMemory)
    }),
    await CheckMenuItem.new({
      text: t('overlay.app'),
      checked: prefs.showApp,
      action: () => (prefs.showApp = !prefs.showApp)
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await CheckMenuItem.new({
      text: t('overlay.down'),
      checked: prefs.showDown,
      action: () => (prefs.showDown = !prefs.showDown)
    }),
    await CheckMenuItem.new({
      text: t('overlay.up'),
      checked: prefs.showUp,
      action: () => (prefs.showUp = !prefs.showUp)
    }),
    await CheckMenuItem.new({
      text: t('overlay.latency'),
      checked: prefs.showLatency,
      action: () => (prefs.showLatency = !prefs.showLatency)
    }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({
      text: t('overlay.closeTaskbarMonitor'),
      action: async () => {
        await store.setTaskbarMonitorEnabled(false);
        try {
          await getCurrentWindow().close();
        } catch {
          // ignore
        }
      }
    })
  ];

  const menu = await Menu.new({ items });
  await menu.popup(new LogicalPosition(event.clientX, event.clientY), getCurrentWindow());
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
