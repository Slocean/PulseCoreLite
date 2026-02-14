<template>
  <section
    ref="overlayRef"
    class="overlay-widget overlay-widget--cyber"
    @dblclick.prevent.stop
    @mousedown="handleOverlayMouseDown">
    <OverlayHeader
      :show-drag-handle="prefs.showDragHandle"
      :app-version="appVersion"
      :app-usage-label="appUsageLabel"
      @startDrag="startDragging"
      @minimize="minimizeOverlay"
      @toggleConfig="showConfig = !showConfig"
      @close="handleClose" />

    <Transition name="slide">
      <OverlayConfigPanel
        v-if="showConfig"
        v-model:prefs="prefs"
        v-model:closeToTray="closeToTray"
        v-model:autoStartEnabled="autoStartEnabled"
        v-model:rememberOverlayPosition="rememberOverlayPosition"
        v-model:taskbarMonitorEnabled="taskbarMonitorEnabled"
        v-model:factoryResetHotkey="factoryResetHotkey"
        v-model:refreshRate="refreshRate"
        v-model:backgroundOpacity="prefs.backgroundOpacity"
        :app-version="appVersion"
        :language="store.settings.language"
        @setLanguage="setLanguage"
        @refreshRateChange="handleRefreshRateChange"
        @factoryReset="handleFactoryReset" />
    </Transition>

    <OverlayMetricsPanel
      :prefs="prefs"
      :metrics="metrics"
      :getUsageClass="getUsageClass"
      :getProgressClass="getProgressClass"
      :diskUsageLabel="diskUsageLabel"
      :diskPercentLabel="diskPercentLabel"
      :diskIoLabel="diskIoLabel"
      :getDiskHardwareLabel="getDiskHardwareLabel" />

    <div class="overlay-divider"></div>

    <OverlayNetworkFooter :prefs="prefs" :network="metrics.network" />

    <OverlayStatusBar :uptimeLabel="uptimeLabel" />
  </section>

  <OverlayDialog
    v-model:open="factoryResetDialogOpen"
    :title="t('overlay.factoryReset')"
    :message="t('overlay.factoryResetConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="resolveFactoryReset(true)"
    @cancel="resolveFactoryReset(false)" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigPanel from '../components/OverlayConfigPanel.vue';
import OverlayDialog from '../components/OverlayDialog.vue';
import OverlayHeader from '../components/OverlayHeader.vue';
import OverlayMetricsPanel from '../components/OverlayMetricsPanel.vue';
import OverlayNetworkFooter from '../components/OverlayNetworkFooter.vue';
import OverlayStatusBar from '../components/OverlayStatusBar.vue';
import { useOverlayMetrics } from '../composables/useOverlayMetrics';
import { useOverlayPrefs } from '../composables/useOverlayPrefs';
import { useOverlayRefreshRate } from '../composables/useOverlayRefreshRate';
import { useOverlayUptime } from '../composables/useOverlayUptime';
import { useOverlayWindow } from '../composables/useOverlayWindow';
import packageJson from '../../package.json';
import { useAppStore } from '../stores/app';
import { matchesHotkeyEvent } from '../utils/hotkey';

const store = useAppStore();
const { t } = useI18n();
const appVersion = packageJson.version;
const showConfig = ref(false);
const closeToTray = computed({
  get: () => store.settings.closeToTray,
  set: value => store.setCloseToTray(value)
});
const autoStartEnabled = computed({
  get: () => store.settings.autoStartEnabled,
  set: value => void store.setAutoStartEnabled(value)
});
const rememberOverlayPosition = computed({
  get: () => store.settings.rememberOverlayPosition,
  set: value => store.setRememberOverlayPosition(value)
});
const taskbarMonitorEnabled = computed({
  get: () => store.settings.taskbarMonitorEnabled,
  set: value => void store.setTaskbarMonitorEnabled(value)
});
const factoryResetHotkey = computed({
  get: () => store.settings.factoryResetHotkey,
  set: value => store.setFactoryResetHotkey(value)
});
const { prefs } = useOverlayPrefs();
const { refreshRate, handleRefreshRateChange } = useOverlayRefreshRate(store);
const { uptimeLabel } = useOverlayUptime();
const appUsageLabel = computed(() => {
  const snap = store.snapshot;
  const cpu = snap.appCpuUsagePct;
  const mem = snap.appMemoryMb;
  if (cpu == null && mem == null) {
    return t('common.na');
  }
  const parts: string[] = [];
  if (cpu != null) parts.push(`${cpu.toFixed(1)}%`);
  if (mem != null) parts.push(`${mem.toFixed(0)}MB`);
  return parts.join(' · ');
});
const {
  metrics,
  getUsageClass,
  getProgressClass,
  diskUsageLabel,
  diskPercentLabel,
  diskIoLabel,
  getDiskHardwareLabel
} = useOverlayMetrics(prefs);
const { overlayRef, startDragging, handleOverlayMouseDown } = useOverlayWindow({
  allowDrag: computed(() => prefs.showDragHandle),
  rememberPosition: computed(() => store.settings.rememberOverlayPosition)
});

const factoryResetDialogOpen = ref(false);
let factoryResetDialogResolver: ((value: boolean) => void) | null = null;

const applyBackgroundOpacity = (value: number) => {
  if (typeof document === 'undefined') {
    return;
  }
  const safeValue = Math.min(100, Math.max(0, value));
  document.documentElement.style.setProperty('--overlay-bg-opacity', String(safeValue / 100));
};

watch(
  () => prefs.backgroundOpacity,
  value => {
    applyBackgroundOpacity(value);
  },
  { immediate: true }
);

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

function resolveFactoryReset(value: boolean) {
  factoryResetDialogOpen.value = false;
  const resolve = factoryResetDialogResolver;
  factoryResetDialogResolver = null;
  resolve?.(value);
}

async function confirmFactoryReset(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // If a dialog is already open, treat subsequent calls as "not confirmed".
  if (factoryResetDialogResolver) {
    factoryResetDialogResolver(false);
    factoryResetDialogResolver = null;
  }

  factoryResetDialogOpen.value = true;
  return await new Promise<boolean>(resolve => {
    factoryResetDialogResolver = resolve;
  });
}

async function handleFactoryReset() {
  const confirmed = await confirmFactoryReset();
  if (!confirmed) {
    return;
  }
  store.factoryReset();
}

function shouldIgnoreHotkeyTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable=\"true\"]'));
}

const hotkeyHandler = (event: KeyboardEvent) => {
  const hotkey = store.settings.factoryResetHotkey;
  if (!hotkey || shouldIgnoreHotkeyTarget(event.target)) {
    return;
  }
  if (!matchesHotkeyEvent(event, hotkey)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void handleFactoryReset();
};

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('keydown', hotkeyHandler);
});

onUnmounted(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('keydown', hotkeyHandler);
});
</script>
