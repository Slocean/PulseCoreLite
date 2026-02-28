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
    <Transition name="toast">
      <div v-if="updateToastVisible" class="overlay-toast-layer" aria-live="polite">
        <div class="overlay-toast">
          {{ updateToastMessage }}
        </div>
      </div>
    </Transition>
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

  <OverlayDialog
    v-model:open="factoryResetDialogOpen"
    :title="t('overlay.factoryReset')"
    :message="t('overlay.factoryResetConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="resolveFactoryReset(true)"
    @cancel="resolveFactoryReset(false)" />

  <OverlayDialog
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
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': backgroundEffect === 'gaussian' }"
              @click="setBackgroundEffect('gaussian')">
              {{ t('overlay.effectGaussian') }}
            </button>
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': backgroundEffect === 'liquidGlass' }"
              @click="setBackgroundEffect('liquidGlass')">
              {{ t('overlay.effectLiquidGlass') }}
            </button>
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
      <button type="button" class="overlay-lang-button" @click="closeBackgroundDialog">
        {{ t('overlay.dialogCancel') }}
      </button>
      <button
        type="button"
        class="overlay-config-primary"
        :disabled="!canApplyBackground"
        @click="applyBackgroundCrop">
        {{ t('overlay.backgroundApply') }}
      </button>
      <button
        type="button"
        class="overlay-config-primary"
        :disabled="!canApplyBackground || !canSaveTheme"
        @click="applyBackgroundAndSave">
        {{ t('overlay.backgroundApplySave') }}
      </button>
    </template>
  </OverlayDialog>

  <OverlayDialog
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
      <button type="button" class="overlay-lang-button" @click="closeThemeNameDialog">
        {{ t('overlay.dialogCancel') }}
      </button>
      <button
        type="button"
        class="overlay-config-primary"
        :disabled="!canConfirmThemeName"
        @click="confirmSaveTheme">
        {{ t('overlay.dialogConfirm') }}
      </button>
    </template>
  </OverlayDialog>

  <OverlayDialog
    v-model:open="themeDeleteDialogOpen"
    :title="t('overlay.themeDeleteTitle')"
    :message="t('overlay.themeDeleteMessage')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmDeleteTheme"
    @cancel="closeDeleteThemeDialog" />

  <OverlayDialog
    v-model:open="themeEditDialogOpen"
    :title="t('overlay.themeEditTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="confirmEditTheme"
    @cancel="closeEditThemeDialog">
    <template #body>
      <div class="overlay-dialog-input-wrap">
        <!-- <div class="overlay-dialog-message">{{ t('overlay.themeEditHint') }}</div> -->
        <input
          v-if="false"
          v-model="themeEditNameInput"
          class="overlay-dialog-input"
          type="text"
          :placeholder="t('overlay.themeNamePlaceholder')"
          maxlength="3" />
        <div class="overlay-config-language overlay-config-effect" style="margin-top: 10px">
          <span class="overlay-config-label">{{ t('overlay.backgroundEffect') }}</span>
          <div class="overlay-lang-buttons overlay-config-effect-buttons">
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': themeEditEffect === 'gaussian' }"
              @click="themeEditEffect = 'gaussian'">
              {{ t('overlay.effectGaussian') }}
            </button>
            <button
              type="button"
              class="overlay-lang-button"
              :class="{ 'overlay-lang-button--active': themeEditEffect === 'liquidGlass' }"
              @click="themeEditEffect = 'liquidGlass'">
              {{ t('overlay.effectLiquidGlass') }}
            </button>
          </div>
        </div>
        <div class="overlay-config-range" style="margin-top: 10px">
          <span class="overlay-config-label">
            {{ themeEditEffect === 'gaussian' ? t('overlay.backgroundBlur') : t('overlay.backgroundGlassBlur') }}
          </span>
          <span class="overlay-config-value">{{ themeEditBlurPx }}px</span>
          <input type="range" min="0" max="24" step="1" v-model.number="themeEditBlurPx" />
        </div>
        <div v-if="themeEditEffect === 'liquidGlass'" class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.backgroundGlassStrength') }}</span>
          <span class="overlay-config-value">{{ themeEditGlassStrength }}%</span>
          <input type="range" min="0" max="100" step="5" v-model.number="themeEditGlassStrength" />
        </div>
      </div>
    </template>
    <template #actions>
      <button type="button" class="overlay-lang-button" @click="closeEditThemeDialog">
        {{ t('overlay.dialogCancel') }}
      </button>
      <button
        type="button"
        class="overlay-config-primary"
        :disabled="!canConfirmThemeEdit"
        @click="confirmEditTheme">
        {{ t('overlay.dialogConfirm') }}
      </button>
    </template>
  </OverlayDialog>

  <OverlayDialog
    v-model:open="importConfirmDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="t('overlay.importConfigConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmImportConfig"
    @cancel="cancelImportConfig" />

  <OverlayDialog
    v-model:open="importErrorDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="importErrorMessage"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeImportErrorDialog"
    @cancel="closeImportErrorDialog" />

  <OverlayDialog
    v-model:open="exportSuccessDialogOpen"
    :title="t('overlay.exportConfig')"
    :message="t('overlay.exportConfigSuccess')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeExportSuccessDialog"
    @cancel="closeExportSuccessDialog" />

  <OverlayDialog
    v-model:open="updateDialogOpen"
    :title="t('overlay.updateTitle')"
    :close-label="t('overlay.dialogClose')"
    @cancel="closeUpdateDialog"
    @confirm="handleInstallUpdate">
    <template #body>
      <div class="overlay-dialog-message overlay-dialog-message--muted">
        {{ t('overlay.updateVersionLabel', { version: updateInfo?.version ?? appVersion }) }}
      </div>
      <div
        class="overlay-dialog-message overlay-dialog-message--pre"
        :class="{ 'overlay-dialog-message--muted': !updateNotes }">
        {{ updateNotes || t('overlay.updateNotesEmpty') }}
      </div>
      <div v-if="updateError" class="overlay-dialog-message overlay-dialog-message--error">
        {{ updateError }}
      </div>
    </template>
    <template #actions>
      <button type="button" class="overlay-lang-button" :disabled="installingUpdate" @click="closeUpdateDialog">
        {{ t('overlay.dialogCancel') }}
      </button>
      <button
        type="button"
        class="overlay-config-primary"
        :disabled="installingUpdate"
        @click="handleInstallUpdate">
        {{ installingUpdate ? t('overlay.updateInstalling') : t('overlay.updateNow') }}
      </button>
    </template>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigPanel from '../components/OverlayConfigPanel.vue';
import OverlayDialog from '../components/OverlayDialog.vue';
import OverlayHeader from '../components/OverlayHeader.vue';
import OverlayMetricsPanel from '../components/OverlayMetricsPanel.vue';
import OverlayNetworkFooter from '../components/OverlayNetworkFooter.vue';
import OverlayStatusBar from '../components/OverlayStatusBar.vue';
import { useConfigTransfer } from '../composables/useConfigTransfer';
import { useFactoryReset } from '../composables/useFactoryReset';
import { useOverlayMetrics } from '../composables/useOverlayMetrics';
import { useOverlayPrefs } from '../composables/useOverlayPrefs';
import { useOverlayRefreshRate } from '../composables/useOverlayRefreshRate';
import { useOverlayUptime } from '../composables/useOverlayUptime';
import { useOverlayWindow } from '../composables/useOverlayWindow';
import { useThemeManager } from '../composables/useThemeManager';
import { useToolkitLauncher } from '../composables/useToolkitLauncher';
import { useUpdater } from '../composables/useUpdater';
import packageJson from '../../package.json';
import { useAppStore } from '../stores/app';
import { api, inTauri } from '../services/tauri';

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
} = useUpdater();
const updateDialogOpen = ref(false);
const updateNotes = computed(() => updateInfo.value?.notes?.trim() ?? '');
const updateToastMessage = ref('');
const updateToastVisible = ref(false);
let updateToastTimer: number | null = null;
const showConfig = ref(false);
const toolkitState = ref<'closed' | 'open' | 'hidden'>('closed');
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
const overlayAlwaysOnTop = computed({
  get: () => store.settings.overlayAlwaysOnTop,
  set: value => store.setOverlayAlwaysOnTop(value)
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
  const cpu = snap.appCpuUsagePct ?? 0;
  const mem = snap.appMemoryMb;
  const parts: string[] = [];
  parts.push(`${cpu.toFixed(1)}%`);
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
  themeEditNameInput,
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

async function refreshToolkitState() {
  if (!inTauri()) {
    toolkitState.value = 'closed';
    return;
  }
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel('toolkit');
    if (!existing) {
      toolkitState.value = 'closed';
      return;
    }
    let visible = true;
    try {
      visible = await existing.isVisible();
    } catch {}
    toolkitState.value = visible ? 'open' : 'hidden';
  } catch {
    toolkitState.value = 'closed';
  }
}

async function toggleToolkitWindow() {
  if (!inTauri()) {
    return;
  }
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel('toolkit');
    if (existing) {
      let visible = true;
      try {
        visible = await existing.isVisible();
      } catch {}
      if (visible) {
        try {
          await existing.close();
        } catch {}
        toolkitState.value = 'closed';
        return;
      }
      try {
        await existing.show();
        await existing.setFocus();
      } catch {}
      toolkitState.value = 'open';
      return;
    }
  } catch {}
  await openToolkitWindow();
  await refreshToolkitState();
}

async function handleVersionClick() {
  await triggerUpdateCheck();
}

async function handleCheckUpdate() {
  await triggerUpdateCheck();
}

function showUpdateToast(message: string) {
  updateToastMessage.value = message;
  updateToastVisible.value = true;
  if (updateToastTimer != null) {
    window.clearTimeout(updateToastTimer);
  }
  updateToastTimer = window.setTimeout(() => {
    updateToastVisible.value = false;
  }, 2000);
}

async function triggerUpdateCheck() {
  if (checkingUpdate.value) {
    return;
  }
  await checkForUpdates();
  if (updateAvailable.value) {
    updateDialogOpen.value = true;
    return;
  }
  if (!updateError.value) {
    showUpdateToast(t('overlay.updateUpToDate'));
  }
}

function closeUpdateDialog() {
  updateDialogOpen.value = false;
}

async function handleInstallUpdate() {
  await installUpdate();
}

async function applyOverlayTopmost(enabled: boolean) {
  if (!inTauri()) {
    return;
  }
  try {
    await api.setWindowSystemTopmost('main', enabled);
  } catch {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setAlwaysOnTop(enabled);
    } catch {}
  }
}

watch(
  overlayAlwaysOnTop,
  enabled => {
    if (!inTauri()) return;
    void applyOverlayTopmost(enabled);
  },
  { immediate: true }
);

watch(
  showConfig,
  value => {
    if (!value) return;
    void refreshToolkitState();
  },
  { immediate: true }
);

onMounted(() => {
  void refreshToolkitState();
  void checkForUpdates();
});

onBeforeUnmount(() => {
  if (updateToastTimer != null) {
    window.clearTimeout(updateToastTimer);
  }
});

function handleClose() {
  void store.exitApp();
}

function minimizeOverlay() {
  void store.minimizeOverlay();
}

function setLanguage(language: 'zh-CN' | 'en-US') {
  store.setLanguage(language);
}
</script>
