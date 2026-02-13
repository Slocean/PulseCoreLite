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
        v-model:refreshRate="refreshRate"
        :app-version="appVersion"
        :language="store.settings.language"
        @setLanguage="setLanguage"
        @refreshRateChange="handleRefreshRateChange" />
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
import { computed, ref } from 'vue';

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
import { useAppStore } from '../stores/app';

const store = useAppStore();
const appVersion = packageJson.version;
const showConfig = ref(false);
const closeToTray = computed({
  get: () => store.settings.closeToTray,
  set: value => store.setCloseToTray(value)
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
  allowDrag: computed(() => prefs.showDragHandle)
});

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
</script>
