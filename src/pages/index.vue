<template>
  <section
    ref="overlayRef"
    class="overlay-widget overlay-widget--cyber"
    @dblclick.prevent.stop
    @mousedown="handleOverlayMouseDown">
    <div v-if="prefs.backgroundImage" class="overlay-bg" :style="overlayBackgroundStyle" aria-hidden="true"></div>
    <div
      v-if="showLiquidGlassHighlight"
      class="overlay-bg overlay-bg--liquid-highlight"
      :style="overlayLiquidGlassHighlightStyle"
      aria-hidden="true"></div>
    <UiToast channel="overlay" />
    <div class="overlay-pane overlay-pane--header">
      <OverlayHeader
        :show-drag-handle="prefs.showDragHandle"
        :app-version="appVersion"
        :app-usage-label="appUsageLabel"
        :update-available="updateAvailable"
        :update-label="t('overlay.updateAvailable')"
        :tabs-expanded="showMainTabs"
        @startDrag="startDragging"
        @minimize="minimizeOverlay"
        @toggleTabs="toggleTabs"
        @close="handleClose"
        @versionClick="handleVersionClick" />
    </div>
    <UiNavTabs
      v-if="showMainTabs"
      v-model="activeMainTab"
      :items="mainNavItems"
      :aria-label="t('overlay.mainNavAriaLabel')" />

    <div class="overlay-pane overlay-pane--content">
      <OverlayConfigPanel
        v-if="activeMainTab === 'settings'"
        v-model:prefs="prefs"
        v-model:closeToTray="closeToTray"
        v-model:autoStartEnabled="autoStartEnabled"
        v-model:memoryTrimEnabled="memoryTrimEnabled"
        v-model:rememberOverlayPosition="rememberOverlayPosition"
        v-model:overlayAlwaysOnTop="overlayAlwaysOnTop"
        v-model:taskbarMonitorEnabled="taskbarMonitorEnabled"
        v-model:factoryResetHotkey="factoryResetHotkey"
        v-model:refreshRate="refreshRate"
        v-model:backgroundOpacity="prefs.backgroundOpacity"
        :can-uninstall="store.installationMode === 'installed'"
        :app-version="appVersion"
        :language="store.settings.language"
        :themes="themes"
        :get-theme-preview-url="getThemePreviewUrl"
        :toolkit-state="toolkitState"
        :checking-update="checkingUpdate"
        @setLanguage="setLanguage"
        @refreshRateChange="handleRefreshRateChange"
        @factoryReset="handleFactoryReset"
        @uninstall="handleUninstall"
        @openBackgroundDialog="openBackgroundDialog"
        @deleteTheme="requestDeleteTheme"
        @editTheme="requestEditTheme"
        @exportConfig="exportConfig"
        @importConfig="handleImportConfig"
        @openToolkit="toggleToolkitWindow"
        @checkUpdate="handleCheckUpdate" />
      <ToolkitEmbedded v-else-if="activeMainTab === 'toolkit'" @openStandalone="openToolkitWindow" />
      <template v-else>
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
      </template>
    </div>
  </section>

  <OverlayThemeDialogs
    v-model:backgroundDialogOpen="backgroundDialogOpen"
    v-model:themeNameDialogOpen="themeNameDialogOpen"
    v-model:themeDeleteDialogOpen="themeDeleteDialogOpen"
    v-model:themeEditDialogOpen="themeEditDialogOpen"
    v-model:themeEditEffect="themeEditEffect"
    v-model:themeEditBlurPx="themeEditBlurPx"
    v-model:themeEditGlassStrength="themeEditGlassStrength"
    v-model:themeNameInput="themeNameInput"
    v-model:backgroundEffect="backgroundEffect"
    v-model:backgroundBlurPx="backgroundBlurPx"
    v-model:backgroundGlassStrength="backgroundGlassStrength"
    :t="t"
    :background-image-source="backgroundImageSource"
    :background-file-name="backgroundFileName"
    :set-background-file-input="setBackgroundFileInput"
    :set-crop-canvas="setCropCanvas"
    :is-dragging="isDragging"
    :can-apply-background="canApplyBackground"
    :can-save-theme="canSaveTheme"
    :can-confirm-theme-name="canConfirmThemeName"
    :can-confirm-theme-edit="canConfirmThemeEdit"
    :apply-background-crop="applyBackgroundCrop"
    :apply-background-and-save="applyBackgroundAndSave"
    :close-background-dialog="closeBackgroundDialog"
    :set-background-effect="setBackgroundEffect"
    :trigger-file-input="triggerFileInput"
    :handle-drag-over="handleDragOver"
    :handle-drag-leave="handleDragLeave"
    :handle-drop="handleDrop"
    :handle-file-change="handleFileChange"
    :handle-crop-mouse-down="handleCropMouseDown"
    :draw-crop-canvas="drawCropCanvas"
    :confirm-save-theme="confirmSaveTheme"
    :close-theme-name-dialog="closeThemeNameDialog"
    :confirm-delete-theme="confirmDeleteTheme"
    :close-delete-theme-dialog="closeDeleteThemeDialog"
    :confirm-edit-theme="confirmEditTheme"
    :close-edit-theme-dialog="closeEditThemeDialog" />

  <OverlaySystemDialogs
    v-model:factoryResetDialogOpen="factoryResetDialogOpen"
    v-model:importConfirmDialogOpen="importConfirmDialogOpen"
    v-model:importErrorDialogOpen="importErrorDialogOpen"
    v-model:exportSuccessDialogOpen="exportSuccessDialogOpen"
    v-model:updateDialogOpen="updateDialogOpen"
    :t="t"
    :app-version="appVersion"
    :update-version="updateInfo?.version"
    :update-notes="updateNotes"
    :update-notes-footer-text="updateNotesFooterText"
    :update-error="updateError"
    :installing-update="installingUpdate"
    :import-error-message="importErrorMessage"
    :resolve-factory-reset="resolveFactoryReset"
    :confirm-import-config="confirmImportConfig"
    :cancel-import-config="cancelImportConfig"
    :close-import-error-dialog="closeImportErrorDialog"
    :close-export-success-dialog="closeExportSuccessDialog"
    :close-update-dialog="closeUpdateDialog"
    :handle-install-update="handleInstallUpdate" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import type { VNodeRef } from 'vue';
import { useI18n } from 'vue-i18n';

import UiNavTabs from '@/components/ui/NavTabs';
import UiToast from '@/components/ui/Toast';
import OverlayHeader from '../components/OverlayHeader.vue';
import OverlayMetricsPanel from '../components/OverlayMetricsPanel.vue';
import OverlayNetworkFooter from '../components/OverlayNetworkFooter.vue';
import OverlayStatusBar from '../components/OverlayStatusBar.vue';
import OverlayThemeDialogs from '../components/overlay/OverlayThemeDialogs.vue';
import OverlaySystemDialogs from '../components/overlay/OverlaySystemDialogs.vue';
import { useConfigTransfer } from '../composables/useConfigTransfer';
import { useFactoryReset } from '../composables/useFactoryReset';
import { useOverlayMetrics } from '../composables/useOverlayMetrics';
import { useOverlayPageController } from '../composables/useOverlayPageController';
import { useOverlayPrefs } from '../composables/useOverlayPrefs';
import { useOverlayRefreshRate } from '../composables/useOverlayRefreshRate';
import { useOverlayUptime } from '../composables/useOverlayUptime';
import { useOverlayToolkitWindow } from '../composables/useOverlayToolkitWindow';
import { useOverlayWindow } from '../composables/useOverlayWindow';
import { openReminderScreensFromPayload } from '../composables/useTaskReminders';
import { useThemeManager } from '../composables/useThemeManager';
import { useToolkitLauncher } from '../composables/useToolkitLauncher';
import { useUpdater } from '../composables/useUpdater';
import packageJson from '../../package.json';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const { t } = useI18n();
const appVersion = packageJson.version;
const OverlayConfigPanel = defineAsyncComponent(() => import('../components/OverlayConfigPanel.vue'));
const ToolkitEmbedded = defineAsyncComponent(() => import('../components/toolkit/ToolkitEmbedded.vue'));
const mainNavItems = computed(() => [
  {
    id: 'monitor',
    label: t('overlay.mainNavMonitor'),
    icon: 'monitor_heart'
  },
  {
    id: 'toolkit',
    label: t('overlay.mainNavToolkit'),
    icon: 'construction'
  },
  {
    id: 'settings',
    label: t('overlay.mainNavSettings'),
    icon: 'settings'
  }
]);
const {
  updateAvailable,
  updateInfo,
  checkingUpdate,
  installingUpdate,
  updateError,
  checkForUpdates,
  installUpdate
} = useUpdater(appVersion);
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

const {
  themes,
  updateThemes,
  getThemePreviewUrl,
  overlayBackgroundStyle,
  showLiquidGlassHighlight,
  overlayLiquidGlassHighlightStyle,
  backgroundDialogOpen,
  backgroundImageSource,
  backgroundFileName,
  backgroundFileInput,
  cropCanvas,
  isDragging,
  backgroundEffect,
  backgroundBlurPx,
  backgroundGlassStrength,
  canApplyBackground,
  canSaveTheme,
  themeNameDialogOpen,
  themeNameInput,
  canConfirmThemeName,
  themeDeleteDialogOpen,
  themeEditDialogOpen,
  themeEditEffect,
  themeEditBlurPx,
  themeEditGlassStrength,
  canConfirmThemeEdit,
  openBackgroundDialog,
  closeBackgroundDialog,
  setBackgroundEffect,
  triggerFileInput,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
  handleCropMouseDown,
  drawCropCanvas,
  applyBackgroundCrop,
  applyBackgroundAndSave,
  requestDeleteTheme,
  confirmDeleteTheme,
  closeDeleteThemeDialog,
  requestEditTheme,
  confirmEditTheme,
  closeEditThemeDialog,
  confirmSaveTheme,
  closeThemeNameDialog
} = useThemeManager({ prefs, overlayRef });

const setBackgroundFileInput: VNodeRef = ref => {
  backgroundFileInput.value = ref instanceof HTMLInputElement ? ref : null;
};

const setCropCanvas: VNodeRef = ref => {
  cropCanvas.value = ref instanceof HTMLCanvasElement ? ref : null;
};

const { factoryResetDialogOpen, resolveFactoryReset, handleFactoryReset, handleUninstall } = useFactoryReset({
  store,
  t
});

const {
  exportSuccessDialogOpen,
  importConfirmDialogOpen,
  importErrorDialogOpen,
  importErrorMessage,
  exportConfig,
  handleImportConfig,
  confirmImportConfig,
  cancelImportConfig,
  closeImportErrorDialog,
  closeExportSuccessDialog
} = useConfigTransfer({
  store,
  prefs,
  themes,
  updateThemes,
  refreshRate,
  t
});

const { openToolkitWindow } = useToolkitLauncher();
const {
  toolkitState,
  refreshToolkitState,
  toggleToolkitWindow,
  dispose: disposeToolkitWindow
} = useOverlayToolkitWindow({
  openToolkitWindow
});
const {
  showConfig,
  closeToTray,
  autoStartEnabled,
  memoryTrimEnabled,
  rememberOverlayPosition,
  overlayAlwaysOnTop,
  taskbarMonitorEnabled,
  factoryResetHotkey,
  appUsageLabel,
  updateDialogOpen,
  updateNotesFooterText,
  updateNotes,
  handleVersionClick,
  handleCheckUpdate,
  closeUpdateDialog,
  handleInstallUpdate,
  handleClose,
  minimizeOverlay,
  setLanguage
} = useOverlayPageController({
  store,
  t,
  updateAvailable,
  updateInfo,
  checkingUpdate,
  updateError,
  checkForUpdates,
  installUpdate,
  refreshToolkitState,
  disposeToolkitWindow,
  onReminderTrigger: payload => {
    void openReminderScreensFromPayload(payload);
  }
});

const activeMainTab = ref<'monitor' | 'toolkit' | 'settings'>('monitor');
const lastNonSettingsTab = ref<'monitor' | 'toolkit'>('monitor');
const showMainTabs = ref(true);

watch(
  activeMainTab,
  tab => {
    if (tab !== 'settings') {
      lastNonSettingsTab.value = tab;
    }
    showConfig.value = tab === 'settings';
  },
  { immediate: true }
);

function toggleTabs() {
  showMainTabs.value = !showMainTabs.value;
}
</script>
