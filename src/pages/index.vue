<template>
  <section
    ref="overlayRef"
    class="overlay-widget overlay-widget--cyber"
    @dblclick.prevent.stop
    @mousedown="handleOverlayMouseDown">
    <OverlayHeader
      :show-drag-handle="prefs.showDragHandle"
      @startDrag="startDragging"
      @minimize="minimizeOverlay"
      @toggleConfig="showConfig = !showConfig"
      @close="handleClose" />

    <Transition name="slide">
      <OverlayConfigPanel
        v-if="showConfig"
        v-model:prefs="prefs"
        v-model:closeToTray="closeToTray"
        v-model:rememberOverlayPosition="rememberOverlayPosition"
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
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigPanel from '../components/OverlayConfigPanel.vue';
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
import { api, inTauri } from '../services/tauri';
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
const rememberOverlayPosition = computed({
  get: () => store.settings.rememberOverlayPosition,
  set: value => store.setRememberOverlayPosition(value)
});
const factoryResetHotkey = computed({
  get: () => store.settings.factoryResetHotkey,
  set: value => store.setFactoryResetHotkey(value)
});
const { prefs } = useOverlayPrefs();
const { refreshRate, handleRefreshRateChange } = useOverlayRefreshRate(store);
const { uptimeLabel } = useOverlayUptime();
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

async function confirmFactoryReset(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  const title = t('overlay.factoryReset');
  const message = t('overlay.factoryResetConfirm');
  if (!inTauri()) {
    // Best-effort fallback for web preview.
    return window.confirm(message);
  }
  try {
    return await api.confirmFactoryReset(title, message);
  } catch {
    return false;
  }
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
