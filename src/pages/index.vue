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
    <OverlayHeader
      :show-drag-handle="prefs.showDragHandle"
      :app-version="appVersion"
      :app-usage-label="appUsageLabel"
      :update-available="updateAvailable"
      :update-label="t('overlay.updateAvailable')"
      @startDrag="startDragging"
      @minimize="minimizeOverlay"
      @toggleConfig="showConfig = !showConfig"
      @close="handleClose"
      @versionClick="handleVersionClick" />

    <Transition name="slide">
      <OverlayConfigPanel
        v-if="showConfig"
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

  <UiDialog
    v-model:open="factoryResetDialogOpen"
    :title="t('overlay.factoryReset')"
    :message="t('overlay.factoryResetConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="resolveFactoryReset(true)"
    @cancel="resolveFactoryReset(false)" />

  <UiDialog
    v-model:open="backgroundDialogOpen"
    :title="t('overlay.backgroundImageTitle')"
    :confirm-text="t('overlay.backgroundApply')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="applyBackgroundCrop"
    @cancel="closeBackgroundDialog">
    <template #body>
      <div class="overlay-background-body">
        <div
          class="overlay-upload"
          :class="{ 'overlay-upload--active': isDragging }"
          @click="triggerFileInput"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop">
          <input
            ref="backgroundFileInput"
            class="overlay-upload-input"
            type="file"
            accept="image/*"
            @change="handleFileChange" />
          <div class="overlay-upload-title">{{ t('overlay.backgroundUpload') }}</div>
          <div class="overlay-upload-subtitle">{{ t('overlay.backgroundUploadHint') }}</div>
          <div v-if="backgroundFileName" class="overlay-upload-name">{{ backgroundFileName }}</div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-crop">
          <div class="overlay-crop-title">{{ t('overlay.backgroundCrop') }}</div>
          <canvas ref="cropCanvas" class="overlay-crop-canvas" @mousedown="handleCropMouseDown"></canvas>
          <div class="overlay-crop-tip">{{ t('overlay.backgroundCropHint') }}</div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-config-language overlay-config-effect">
          <span class="overlay-config-label">{{ t('overlay.backgroundEffect') }}</span>
          <div class="overlay-lang-buttons overlay-config-effect-buttons">
            <UiButton
              native-type="button"
              preset="overlay-chip-soft"
              :active="backgroundEffect === 'gaussian'"
              @click="setBackgroundEffect('gaussian')">
              {{ t('overlay.effectGaussian') }}
            </UiButton>
            <UiButton
              native-type="button"
              preset="overlay-chip-soft"
              :active="backgroundEffect === 'liquidGlass'"
              @click="setBackgroundEffect('liquidGlass')">
              {{ t('overlay.effectLiquidGlass') }}
            </UiButton>
          </div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-config-range">
          <span class="overlay-config-label">
            {{ backgroundEffect === 'gaussian' ? t('overlay.backgroundBlur') : t('overlay.backgroundGlassBlur') }}
          </span>
          <span class="overlay-config-value">{{ backgroundBlurPx }}px</span>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            v-model.number="backgroundBlurPx"
            @input="drawCropCanvas" />
        </div>
        <div v-if="backgroundImageSource && backgroundEffect === 'liquidGlass'" class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.backgroundGlassStrength') }}</span>
          <span class="overlay-config-value">{{ backgroundGlassStrength }}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            v-model.number="backgroundGlassStrength"
            @input="drawCropCanvas" />
        </div>
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="closeBackgroundDialog">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canApplyBackground"
        @click="applyBackgroundCrop">
        {{ t('overlay.backgroundApply') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canApplyBackground || !canSaveTheme"
        @click="applyBackgroundAndSave">
        {{ t('overlay.backgroundApplySave') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiDialog
    v-model:open="themeNameDialogOpen"
    :title="t('overlay.themeSaveTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="confirmSaveTheme"
    @cancel="closeThemeNameDialog">
    <template #body>
      <div class="overlay-dialog-input-wrap">
        <div class="overlay-dialog-message">{{ t('overlay.themeNameHint') }}</div>
        <input
          v-model="themeNameInput"
          class="overlay-dialog-input"
          type="text"
          :placeholder="t('overlay.themeNamePlaceholder')"
          maxlength="3" />
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="closeThemeNameDialog">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canConfirmThemeName"
        @click="confirmSaveTheme">
        {{ t('overlay.dialogConfirm') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiDialog
    v-model:open="themeDeleteDialogOpen"
    :title="t('overlay.themeDeleteTitle')"
    :message="t('overlay.themeDeleteMessage')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmDeleteTheme"
    @cancel="closeDeleteThemeDialog" />

  <OverlayThemeEditDialog
    v-model:open="themeEditDialogOpen"
    v-model:effect="themeEditEffect"
    v-model:blurPx="themeEditBlurPx"
    v-model:glassStrength="themeEditGlassStrength"
    :can-confirm-theme-edit="canConfirmThemeEdit"
    @confirm="confirmEditTheme"
    @cancel="closeEditThemeDialog" />

  <UiDialog
    v-model:open="importConfirmDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="t('overlay.importConfigConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmImportConfig"
    @cancel="cancelImportConfig" />

  <UiDialog
    v-model:open="importErrorDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="importErrorMessage"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeImportErrorDialog"
    @cancel="closeImportErrorDialog" />

  <UiDialog
    v-model:open="exportSuccessDialogOpen"
    :title="t('overlay.exportConfig')"
    :message="t('overlay.exportConfigSuccess')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeExportSuccessDialog"
    @cancel="closeExportSuccessDialog" />

  <OverlayUpdateDialog
    v-model:open="updateDialogOpen"
    :app-version="appVersion"
    :update-version="updateInfo?.version"
    :update-notes="updateNotes"
    :update-notes-footer-text="updateNotesFooterText"
    :update-error="updateError"
    :installing-update="installingUpdate"
    @cancel="closeUpdateDialog"
    @confirm="handleInstallUpdate" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiToast from '@/components/ui/Toast';
import OverlayConfigPanel from '../components/OverlayConfigPanel.vue';
import OverlayThemeEditDialog from '../components/overlay/OverlayThemeEditDialog.vue';
import OverlayUpdateDialog from '../components/overlay/OverlayUpdateDialog.vue';
import UiDialog from '@/components/ui/Dialog';
import OverlayHeader from '../components/OverlayHeader.vue';
import OverlayMetricsPanel from '../components/OverlayMetricsPanel.vue';
import OverlayNetworkFooter from '../components/OverlayNetworkFooter.vue';
import OverlayStatusBar from '../components/OverlayStatusBar.vue';
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
const { toolkitState, refreshToolkitState, toggleToolkitWindow, dispose: disposeToolkitWindow } =
  useOverlayToolkitWindow({
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
</script>


