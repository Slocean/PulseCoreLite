<template>
  <section
    ref="barRef"
    class="taskbar-bar"
    role="presentation"
    @mousedown="handleMouseDown"
    @dblclick.prevent.stop="showMainWindow"
    @contextmenu.prevent.stop="openContextMenu">
    <div class="taskbar-row">
      <template v-for="(seg, idx) in segments" :key="seg.id">
        <span v-if="idx > 0" class="taskbar-sep">|</span>
        <span class="taskbar-seg">
          <span class="taskbar-k">{{ seg.label }}</span>
          <span class="taskbar-v" :class="seg.valueClass">{{ seg.value }}</span>
          <span v-if="seg.extra" class="taskbar-extra">{{ seg.extra }}</span>
        </span>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useTaskbarPrefs } from '../composables/useTaskbarPrefs';
import { useTaskbarWindow } from '../composables/useTaskbarWindow';
import { api, inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { t } = useI18n();
const { prefs } = useTaskbarPrefs();

const rememberPosition = computed(() => store.settings.rememberOverlayPosition);
const { barRef, handleMouseDown, scheduleResize } = useTaskbarWindow({ rememberPosition });

const snapshot = computed(() => store.snapshot);

const cpuPct = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(0)}%`);
const cpuFreq = computed(() => {
  const freq = snapshot.value.cpu.frequency_mhz;
  if (!freq) return null;
  return `${(freq / 1000).toFixed(1)}G`;
});
const cpuTemp = computed(() => {
  const temp = snapshot.value.cpu.temperature_c;
  if (temp == null) return null;
  return `${temp.toFixed(0)}C`;
});

const gpuPct = computed(() => {
  const pct = snapshot.value.gpu.usage_pct;
  return pct == null ? null : `${pct.toFixed(0)}%`;
});
const gpuTemp = computed(() => {
  const temp = snapshot.value.gpu.temperature_c;
  if (temp == null) return null;
  return `${temp.toFixed(0)}C`;
});

const memPct = computed(() => `${snapshot.value.memory.usage_pct.toFixed(0)}%`);
const memUsage = computed(() => {
  const used = snapshot.value.memory.used_mb / 1024;
  const total = snapshot.value.memory.total_mb / 1024;
  return `${used.toFixed(1)}/${total.toFixed(0)}G`;
});

const down = computed(() => (snapshot.value.network.download_bytes_per_sec / 1024 / 1024).toFixed(1));
const up = computed(() => (snapshot.value.network.upload_bytes_per_sec / 1024 / 1024).toFixed(1));
const latency = computed(() => {
  const value = snapshot.value.network.latency_ms;
  return value == null ? null : `${value.toFixed(0)}ms`;
});

function usageClass(value: number, base: 'cyan' | 'pink') {
  if (value > 85) return 'overlay-glow-red';
  if (value > 75) return 'overlay-glow-orange';
  return base === 'cyan' ? 'overlay-glow-cyan' : 'overlay-glow-pink';
}

const segments = computed(() => {
  const parts: Array<{ id: string; label: string; value: string; extra?: string; valueClass?: string }> = [];

  if (prefs.showCpu) {
    const extras: string[] = [];
    if (prefs.showCpuFreq && cpuFreq.value) extras.push(cpuFreq.value);
    if (prefs.showCpuTemp && cpuTemp.value) extras.push(cpuTemp.value);
    parts.push({
      id: 'cpu',
      label: 'CPU',
      value: cpuPct.value,
      extra: extras.length > 0 ? extras.join(' ') : undefined,
      valueClass: usageClass(snapshot.value.cpu.usage_pct, 'cyan')
    });
  }

  if (prefs.showGpu) {
    const value = gpuPct.value ?? t('common.na');
    const extras: string[] = [];
    if (prefs.showGpuTemp && gpuTemp.value) extras.push(gpuTemp.value);
    parts.push({
      id: 'gpu',
      label: 'GPU',
      value,
      extra: extras.length > 0 ? extras.join(' ') : undefined,
      valueClass: snapshot.value.gpu.usage_pct == null ? '' : usageClass(snapshot.value.gpu.usage_pct, 'pink')
    });
  }

  if (prefs.showMemory) {
    parts.push({
      id: 'ram',
      label: 'RAM',
      value: memPct.value,
      extra: memUsage.value
    });
  }

  if (prefs.showDown) {
    parts.push({ id: 'down', label: 'D', value: down.value, extra: 'MB/s' });
  }

  if (prefs.showUp) {
    parts.push({ id: 'up', label: 'U', value: up.value, extra: 'MB/s' });
  }

  if (prefs.showLatency) {
    parts.push({ id: 'lat', label: 'L', value: latency.value ?? t('common.na') });
  }

  return parts;
});

async function showMainWindow() {
  await store.toggleOverlay(true);
}

async function openContextMenu(event: MouseEvent) {
  if (!inTauri()) {
    return;
  }

  const [{ Menu, CheckMenuItem, MenuItem, PredefinedMenuItem }, { LogicalPosition }, { getCurrentWindow }] =
    await Promise.all([import('@tauri-apps/api/menu'), import('@tauri-apps/api/dpi'), import('@tauri-apps/api/window')]);

  const items = [
    await MenuItem.new({
      text: t('overlay.openMainWindow'),
      action: () => void showMainWindow()
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
</script>
