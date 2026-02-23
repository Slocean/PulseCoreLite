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
        :can-uninstall="store.installationMode === 'installed'"
        :app-version="appVersion"
        :language="store.settings.language"
        :themes="themes"
        @setLanguage="setLanguage"
        @refreshRateChange="handleRefreshRateChange"
        @factoryReset="handleFactoryReset"
        @uninstall="handleUninstall"
        @openBackgroundDialog="openBackgroundDialog"
        @deleteTheme="requestDeleteTheme"
        @editTheme="requestEditTheme"
        @exportConfig="exportConfig"
        @importConfig="handleImportConfig" />
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
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigPanel from '../components/OverlayConfigPanel.vue';
import OverlayDialog from '../components/OverlayDialog.vue';
import OverlayHeader from '../components/OverlayHeader.vue';
import OverlayMetricsPanel from '../components/OverlayMetricsPanel.vue';
import OverlayNetworkFooter from '../components/OverlayNetworkFooter.vue';
import OverlayStatusBar from '../components/OverlayStatusBar.vue';
import { useOverlayMetrics } from '../composables/useOverlayMetrics';
import {
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_BACKGROUND_GLASS_STRENGTH,
  useOverlayPrefs,
  type OverlayBackgroundEffect
} from '../composables/useOverlayPrefs';
import { useOverlayRefreshRate } from '../composables/useOverlayRefreshRate';
import { useOverlayUptime } from '../composables/useOverlayUptime';
import { useOverlayWindow } from '../composables/useOverlayWindow';
import packageJson from '../../package.json';
import { useAppStore } from '../stores/app';
import { api, inTauri } from '../services/tauri';
import { kvGet, kvSet } from '../utils/kv';
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

type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
};

const THEME_STORAGE_KEY = 'pulsecorelite.overlay_themes';

const factoryResetDialogOpen = ref(false);
let factoryResetDialogResolver: ((value: boolean) => void) | null = null;
const backgroundDialogOpen = ref(false);
const backgroundImageSource = ref<string | null>(null);
const backgroundFileName = ref('');
const backgroundFileInput = ref<HTMLInputElement | null>(null);
const cropCanvas = ref<HTMLCanvasElement | null>(null);
const isDragging = ref(false);
const backgroundImage = ref<HTMLImageElement | null>(null);
const cropAspect = ref(1.6);
const cropRect = reactive({
  x: 0,
  y: 0,
  width: 0,
  height: 0
});
const dragState = reactive({
  active: false,
  mode: 'move' as 'move' | 'resize',
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  originW: 0,
  originH: 0
});
const imageFit = reactive({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  drawWidth: 0,
  drawHeight: 0,
  canvasWidth: 0,
  canvasHeight: 0
});

const themes = ref<OverlayTheme[]>([]);
const themeNameDialogOpen = ref(false);
const themeNameInput = ref('');
const pendingThemeImage = ref<string | null>(null);
const pendingThemeBlurPx = ref(0);
const pendingThemeEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
const pendingThemeGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);
const themeDeleteDialogOpen = ref(false);
const themeToDelete = ref<OverlayTheme | null>(null);
const backgroundBlurPx = ref(0);
const backgroundEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
const backgroundGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);
const exportSuccessDialogOpen = ref(false);

const themeEditDialogOpen = ref(false);
const themeToEdit = ref<OverlayTheme | null>(null);
const themeEditNameInput = ref('');
const themeEditBlurPx = ref(0);
const themeEditEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
const themeEditGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);

const importConfirmDialogOpen = ref(false);
const pendingImportConfig = ref<any | null>(null);
const importErrorDialogOpen = ref(false);
const importErrorMessage = ref('');

if (typeof window !== 'undefined') {
  // Sync bootstrap from legacy localStorage to avoid a blank UI while IndexedDB hydrates.
  themes.value = loadThemesFromLocalStorage();
  void hydrateThemes();
}

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

function clampBlurPx(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(40, Math.round(value))) : 0;
}

function clampGlassStrength(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function normalizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : DEFAULT_BACKGROUND_EFFECT;
}

function getBackgroundFilter(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    const minBlur = Math.max(2, safeBlur);
    const saturation = (1.25 + safeStrength / 140).toFixed(2);
    const contrast = (1.05 + safeStrength / 420).toFixed(2);
    const brightness = (1.01 + safeStrength / 900).toFixed(2);
    return `blur(${minBlur}px) saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}

function getBackgroundScale(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    return (1.06 + safeStrength / 1000).toFixed(3);
  }
  return (clampBlurPx(blurPx) > 0 ? 1.05 : 1).toString();
}

const overlayBackgroundStyle = computed(() => {
  if (!prefs.backgroundImage) {
    return {};
  }
  const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
  const blurPx = clampBlurPx(prefs.backgroundBlurPx);
  const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
  return {
    backgroundImage: `url(${prefs.backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    // Effect applies only to the background layer, not overlay content.
    filter: getBackgroundFilter(effect, blurPx, glassStrength),
    transform: `scale(${getBackgroundScale(effect, blurPx, glassStrength)})`
  };
});

const showLiquidGlassHighlight = computed(() => {
  return Boolean(prefs.backgroundImage && normalizeBackgroundEffect(prefs.backgroundEffect) === 'liquidGlass');
});

const overlayLiquidGlassHighlightStyle = computed(() => {
  const safeStrength = clampGlassStrength(prefs.backgroundGlassStrength);
  const opacity = (0.08 + safeStrength / 600).toFixed(3);
  return {
    opacity,
    background:
      'radial-gradient(circle at 20% -10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), linear-gradient(165deg, rgba(255,255,255,0.2), rgba(120,180,255,0.08) 38%, rgba(0,0,0,0) 75%)'
  };
});

const canApplyBackground = computed(() => {
  return Boolean(backgroundImage.value && cropRect.width > 0 && cropRect.height > 0);
});
const canSaveTheme = computed(() => themes.value.length < 3);
const canConfirmThemeName = computed(() => {
  const value = themeNameInput.value.trim();
  return Boolean(value && value.length <= 3 && pendingThemeImage.value);
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

async function handleUninstall() {
  await store.uninstallApp(t('overlay.uninstallTitle'), t('overlay.uninstallConfirm'));
}

function openBackgroundDialog() {
  backgroundDialogOpen.value = true;
  // Always start from a clean state; otherwise reopening can show a stale previous image.
  resetBackgroundDialogState();
  nextTick(() => refreshCropAspect());
}

function closeBackgroundDialog() {
  backgroundDialogOpen.value = false;
  isDragging.value = false;
  handleCropMouseUp();
  resetBackgroundDialogState();
}

function resetBackgroundDialogState() {
  backgroundFileName.value = '';
  backgroundImageSource.value = null;
  backgroundImage.value = null;
  backgroundEffect.value = prefs.backgroundImage
    ? normalizeBackgroundEffect(prefs.backgroundEffect)
    : DEFAULT_BACKGROUND_EFFECT;
  backgroundGlassStrength.value = prefs.backgroundImage
    ? clampGlassStrength(prefs.backgroundGlassStrength)
    : DEFAULT_BACKGROUND_GLASS_STRENGTH;
  backgroundBlurPx.value = prefs.backgroundImage ? clampBlurPx(prefs.backgroundBlurPx) : 5;
  cropRect.x = 0;
  cropRect.y = 0;
  cropRect.width = 0;
  cropRect.height = 0;
}

function setBackgroundEffect(effect: OverlayBackgroundEffect) {
  backgroundEffect.value = effect;
  if (effect === 'liquidGlass' && backgroundBlurPx.value < 2) {
    backgroundBlurPx.value = 2;
  }
  drawCropCanvas();
}

function refreshCropAspect() {
  const rect = overlayRef.value?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    cropAspect.value = rect.width / rect.height;
    return;
  }
  cropAspect.value = 1.6;
}

function triggerFileInput() {
  backgroundFileInput.value?.click();
}

function handleDragOver() {
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }
  handleFile(file);
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  handleFile(file);
  if (input) {
    input.value = '';
  }
}

function sanitizeThemes(input: unknown): OverlayTheme[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String((item as any).id),
      name: String((item as any).name),
      image: String((item as any).image),
      blurPx: clampBlurPx((item as any).blurPx),
      effect: normalizeBackgroundEffect((item as any).effect),
      glassStrength: clampGlassStrength((item as any).glassStrength)
    }))
    .filter(item => item.id && item.name && item.image);
}

function loadThemesFromLocalStorage(): OverlayTheme[] {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return sanitizeThemes(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persistThemes(next: OverlayTheme[]) {
  if (typeof window === 'undefined') {
    return;
  }
  // Use IndexedDB to avoid localStorage quota issues (themes can include large data URLs).
  void kvSet(THEME_STORAGE_KEY, next);
}

function updateThemes(next: OverlayTheme[]) {
  themes.value = next;
  persistThemes(next);
}

async function hydrateThemes() {
  const fromKv = await kvGet<unknown>(THEME_STORAGE_KEY);
  const parsed = sanitizeThemes(fromKv);
  if (parsed.length) {
    themes.value = parsed;
  } else if (themes.value.length) {
    await kvSet(THEME_STORAGE_KEY, themes.value);
  }

  // Legacy cleanup: free localStorage quota once migrated to IndexedDB.
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function requestDeleteTheme(id: string) {
  const target = themes.value.find(theme => theme.id === id) ?? null;
  if (!target) {
    return;
  }
  themeToDelete.value = target;
  themeDeleteDialogOpen.value = true;
}

function closeDeleteThemeDialog() {
  themeDeleteDialogOpen.value = false;
  themeToDelete.value = null;
}

function isThemeApplied(theme: OverlayTheme) {
  return (
    prefs.backgroundImage === theme.image &&
    clampBlurPx(prefs.backgroundBlurPx) === clampBlurPx(theme.blurPx) &&
    normalizeBackgroundEffect(prefs.backgroundEffect) === normalizeBackgroundEffect(theme.effect) &&
    clampGlassStrength(prefs.backgroundGlassStrength) === clampGlassStrength(theme.glassStrength)
  );
}

function confirmDeleteTheme() {
  const target = themeToDelete.value;
  if (!target) {
    closeDeleteThemeDialog();
    return;
  }
  const wasApplied = isThemeApplied(target);
  const nextThemes = themes.value.filter(theme => theme.id !== target.id);
  updateThemes(nextThemes);
  if (wasApplied) {
    prefs.backgroundImage = null;
    prefs.backgroundBlurPx = 0;
    prefs.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
    prefs.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
  }
  closeDeleteThemeDialog();
}

const canConfirmThemeEdit = computed(() => {
  const target = themeToEdit.value;
  if (!target) return false;
  const name = themeEditNameInput.value.trim();
  if (!name || name.length > 3) return false;
  if (!Number.isFinite(themeEditBlurPx.value) || themeEditBlurPx.value < 0 || themeEditBlurPx.value > 24) {
    return false;
  }
  return (
    Number.isFinite(themeEditGlassStrength.value) &&
    themeEditGlassStrength.value >= 0 &&
    themeEditGlassStrength.value <= 100
  );
});

function requestEditTheme(id: string) {
  const target = themes.value.find(theme => theme.id === id) ?? null;
  if (!target) return;
  themeToEdit.value = target;
  themeEditNameInput.value = target.name;
  themeEditBlurPx.value = Math.max(0, Math.min(24, Math.round(target.blurPx ?? 0)));
  themeEditEffect.value = normalizeBackgroundEffect(target.effect);
  themeEditGlassStrength.value = clampGlassStrength(target.glassStrength);
  themeEditDialogOpen.value = true;
}

function closeEditThemeDialog() {
  themeEditDialogOpen.value = false;
  themeToEdit.value = null;
  themeEditNameInput.value = '';
  themeEditBlurPx.value = 0;
  themeEditEffect.value = DEFAULT_BACKGROUND_EFFECT;
  themeEditGlassStrength.value = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function confirmEditTheme() {
  const target = themeToEdit.value;
  if (!target || !canConfirmThemeEdit.value) {
    closeEditThemeDialog();
    return;
  }
  const wasApplied = isThemeApplied(target);
  const nextName = themeEditNameInput.value.trim().slice(0, 3);
  const nextBlur = Math.max(0, Math.min(24, Math.round(themeEditBlurPx.value)));
  const nextEffect = normalizeBackgroundEffect(themeEditEffect.value);
  const nextGlassStrength = clampGlassStrength(themeEditGlassStrength.value);
  const nextThemes = themes.value.map(theme =>
    theme.id === target.id
      ? { ...theme, name: nextName, blurPx: nextBlur, effect: nextEffect, glassStrength: nextGlassStrength }
      : theme
  );
  updateThemes(nextThemes);

  // If this theme is active, apply updated effect settings immediately.
  if (wasApplied) {
    prefs.backgroundBlurPx = nextBlur;
    prefs.backgroundEffect = nextEffect;
    prefs.backgroundGlassStrength = nextGlassStrength;
  }

  closeEditThemeDialog();
}

function openThemeNameDialog(image: string) {
  pendingThemeImage.value = image;
  pendingThemeBlurPx.value = backgroundBlurPx.value;
  pendingThemeEffect.value = backgroundEffect.value;
  pendingThemeGlassStrength.value = backgroundGlassStrength.value;
  themeNameInput.value = '';
  themeNameDialogOpen.value = true;
}

function closeThemeNameDialog() {
  themeNameDialogOpen.value = false;
  pendingThemeImage.value = null;
  pendingThemeBlurPx.value = 0;
  pendingThemeEffect.value = DEFAULT_BACKGROUND_EFFECT;
  pendingThemeGlassStrength.value = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function handleFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return;
  }
  backgroundFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      return;
    }
    backgroundImageSource.value = reader.result;
    void loadBackgroundImage(reader.result);
  };
  reader.readAsDataURL(file);
}

async function loadBackgroundImage(src: string) {
  const img = new Image();
  img.onload = async () => {
    backgroundImage.value = img;
    await nextTick();
    updateCanvasFromImage();
  };
  img.src = src;
}

function updateCanvasFromImage() {
  const canvas = cropCanvas.value;
  const img = backgroundImage.value;
  if (!canvas || !img) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  imageFit.canvasWidth = canvas.width;
  imageFit.canvasHeight = canvas.height;
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  imageFit.scale = scale;
  imageFit.drawWidth = img.width * scale;
  imageFit.drawHeight = img.height * scale;
  imageFit.offsetX = (canvas.width - imageFit.drawWidth) / 2;
  imageFit.offsetY = (canvas.height - imageFit.drawHeight) / 2;
  resetCropRect();
  drawCropCanvas();
}

function resetCropRect() {
  if (!backgroundImage.value) {
    return;
  }
  const maxWidth = imageFit.drawWidth * 0.8;
  let width = maxWidth;
  let height = width / cropAspect.value;
  if (height > imageFit.drawHeight * 0.8) {
    height = imageFit.drawHeight * 0.8;
    width = height * cropAspect.value;
  }
  width = Math.max(40, width);
  height = Math.max(40, height);
  cropRect.width = width;
  cropRect.height = height;
  cropRect.x = imageFit.offsetX + (imageFit.drawWidth - width) / 2;
  cropRect.y = imageFit.offsetY + (imageFit.drawHeight - height) / 2;
}

function drawCropCanvas() {
  const canvas = cropCanvas.value;
  const img = backgroundImage.value;
  if (!canvas || !img) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const effect = normalizeBackgroundEffect(backgroundEffect.value);
  const blurPx = Math.max(0, Math.min(24, Math.round(backgroundBlurPx.value)));
  const glassStrength = clampGlassStrength(backgroundGlassStrength.value);
  // Preview selected effect in the crop UI; the theme persists these values separately.
  ctx.filter = getBackgroundFilter(effect, blurPx, glassStrength);
  ctx.drawImage(img, imageFit.offsetX, imageFit.offsetY, imageFit.drawWidth, imageFit.drawHeight);
  ctx.filter = 'none';
  if (effect === 'liquidGlass') {
    const gloss = 0.08 + glassStrength / 650;
    const gradient = ctx.createLinearGradient(
      imageFit.offsetX,
      imageFit.offsetY,
      imageFit.offsetX,
      imageFit.offsetY + imageFit.drawHeight
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.22, gloss + 0.05).toFixed(3)})`);
    gradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.06)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(imageFit.offsetX, imageFit.offsetY, imageFit.drawWidth, imageFit.drawHeight);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(0, 242, 255, 0.9)';
  ctx.lineWidth = Math.max(1, Math.round(window.devicePixelRatio || 1));
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
}

function getCanvasPoint(event: MouseEvent) {
  const canvas = cropCanvas.value;
  if (!canvas) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function handleCropMouseDown(event: MouseEvent) {
  if (!backgroundImage.value) {
    return;
  }
  const point = getCanvasPoint(event);
  if (!point) {
    return;
  }
  event.preventDefault();
  const inX = point.x >= cropRect.x && point.x <= cropRect.x + cropRect.width;
  const inY = point.y >= cropRect.y && point.y <= cropRect.y + cropRect.height;
  dragState.active = true;
  dragState.startX = point.x;
  dragState.startY = point.y;
  dragState.originX = cropRect.x;
  dragState.originY = cropRect.y;
  dragState.originW = cropRect.width;
  dragState.originH = cropRect.height;
  dragState.mode = inX && inY ? 'move' : 'resize';
  window.addEventListener('mousemove', handleCropMouseMove, true);
  window.addEventListener('mouseup', handleCropMouseUp, true);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function handleCropMouseMove(event: MouseEvent) {
  if (!dragState.active) {
    return;
  }
  const point = getCanvasPoint(event);
  if (!point) {
    return;
  }
  if (dragState.mode === 'move') {
    const nextX = dragState.originX + (point.x - dragState.startX);
    const nextY = dragState.originY + (point.y - dragState.startY);
    const minX = imageFit.offsetX;
    const minY = imageFit.offsetY;
    const maxX = imageFit.offsetX + imageFit.drawWidth - cropRect.width;
    const maxY = imageFit.offsetY + imageFit.drawHeight - cropRect.height;
    cropRect.x = clamp(nextX, minX, maxX);
    cropRect.y = clamp(nextY, minY, maxY);
  } else {
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    let width = Math.abs(dx);
    let height = width / cropAspect.value;
    if (width < 40) {
      width = 40;
      height = width / cropAspect.value;
    }
    let nextX = dx >= 0 ? dragState.startX : dragState.startX - width;
    let nextY = dy >= 0 ? dragState.startY : dragState.startY - height;
    if (nextX < imageFit.offsetX) {
      nextX = imageFit.offsetX;
    }
    if (nextY < imageFit.offsetY) {
      nextY = imageFit.offsetY;
    }
    if (nextX + width > imageFit.offsetX + imageFit.drawWidth) {
      nextX = imageFit.offsetX + imageFit.drawWidth - width;
    }
    if (nextY + height > imageFit.offsetY + imageFit.drawHeight) {
      nextY = imageFit.offsetY + imageFit.drawHeight - height;
    }
    cropRect.x = nextX;
    cropRect.y = nextY;
    cropRect.width = width;
    cropRect.height = height;
  }
  drawCropCanvas();
}

function handleCropMouseUp() {
  if (!dragState.active) {
    return;
  }
  dragState.active = false;
  window.removeEventListener('mousemove', handleCropMouseMove, true);
  window.removeEventListener('mouseup', handleCropMouseUp, true);
}

function getCroppedBackground() {
  const img = backgroundImage.value;
  if (!img) {
    return null;
  }
  const cropX = clamp((cropRect.x - imageFit.offsetX) / imageFit.scale, 0, img.width - 1);
  const cropY = clamp((cropRect.y - imageFit.offsetY) / imageFit.scale, 0, img.height - 1);
  const cropWidth = clamp(cropRect.width / imageFit.scale, 1, img.width - cropX);
  const cropHeight = clamp(cropRect.height / imageFit.scale, 1, img.height - cropY);
  const output = document.createElement('canvas');
  output.width = Math.round(cropWidth);
  output.height = Math.round(cropHeight);
  const ctx = output.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, output.width, output.height);

  // Keep persisted images small to avoid storage quota/perf issues.
  const MAX_W = 1400;
  const MAX_H = 900;
  const scale = Math.min(1, MAX_W / output.width, MAX_H / output.height);

  let finalCanvas = output;
  if (scale < 1) {
    const scaled = document.createElement('canvas');
    scaled.width = Math.max(1, Math.round(output.width * scale));
    scaled.height = Math.max(1, Math.round(output.height * scale));
    const sctx = scaled.getContext('2d');
    if (sctx) {
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(output, 0, 0, scaled.width, scaled.height);
      finalCanvas = scaled;
    }
  }

  return finalCanvas.toDataURL('image/jpeg', 0.85);
}

function applyBackgroundCrop() {
  const dataUrl = getCroppedBackground();
  if (!dataUrl) {
    return;
  }
  prefs.backgroundImage = dataUrl;
  prefs.backgroundBlurPx = clampBlurPx(backgroundBlurPx.value);
  prefs.backgroundEffect = normalizeBackgroundEffect(backgroundEffect.value);
  prefs.backgroundGlassStrength = clampGlassStrength(backgroundGlassStrength.value);
  closeBackgroundDialog();
}

function applyBackgroundAndSave() {
  if (!canSaveTheme.value) {
    return;
  }
  const dataUrl = getCroppedBackground();
  if (!dataUrl) {
    return;
  }
  prefs.backgroundImage = dataUrl;
  prefs.backgroundBlurPx = clampBlurPx(backgroundBlurPx.value);
  prefs.backgroundEffect = normalizeBackgroundEffect(backgroundEffect.value);
  prefs.backgroundGlassStrength = clampGlassStrength(backgroundGlassStrength.value);
  closeBackgroundDialog();
  // openThemeNameDialog(dataUrl);
  const name = `主题${themes.value.length + 1}`;
  saveThemeWithName(name, dataUrl, backgroundBlurPx.value, backgroundEffect.value, backgroundGlassStrength.value);
}

function saveThemeWithName(
  name: string,
  image: string,
  blurPx: number,
  effect: OverlayBackgroundEffect,
  glassStrength: number
) {
  if (!canSaveTheme.value) {
    return;
  }
  const theme: OverlayTheme = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    image,
    blurPx: clampBlurPx(blurPx),
    effect: normalizeBackgroundEffect(effect),
    glassStrength: clampGlassStrength(glassStrength)
  };
  updateThemes([...themes.value, theme].slice(0, 3));
}

function confirmSaveTheme() {
  if (!pendingThemeImage.value) {
    return;
  }
  const name = themeNameInput.value.trim().slice(0, 3);
  if (!name) {
    return;
  }
  saveThemeWithName(
    name,
    pendingThemeImage.value,
    pendingThemeBlurPx.value,
    pendingThemeEffect.value,
    pendingThemeGlassStrength.value
  );
  closeThemeNameDialog();
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function exportConfig() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const payload = {
    schema: 'pulsecorelite.config',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: store.settings,
    refreshRateMs: refreshRate.value,
    overlayPrefs: JSON.parse(JSON.stringify(prefs)),
    overlayThemes: themes.value,
    taskbarPrefs: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.taskbar_prefs')),
    overlayPosition: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.overlay_pos')),
    taskbarPosition: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.taskbar_pos'))
  };

  const json = JSON.stringify(payload, null, 2);
  const ts = payload.exportedAt.replace(/[:.]/g, '-');
  const filename = `pulsecorelite-config-${ts}.json`;

  if (inTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (!path) return;
      await api.saveExportConfig(path, json);
      exportSuccessDialogOpen.value = true;
      return;
    } catch {}
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  exportSuccessDialogOpen.value = true;
}

async function handleImportConfig(file: File) {
  if (typeof window === 'undefined') return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('invalid');
    }
    pendingImportConfig.value = parsed;
    importConfirmDialogOpen.value = true;
  } catch {
    pendingImportConfig.value = null;
    importErrorMessage.value = t('overlay.importConfigInvalid');
    importErrorDialogOpen.value = true;
  }
}

function cancelImportConfig() {
  importConfirmDialogOpen.value = false;
  pendingImportConfig.value = null;
}

function closeImportErrorDialog() {
  importErrorDialogOpen.value = false;
  importErrorMessage.value = '';
}

function closeExportSuccessDialog() {
  exportSuccessDialogOpen.value = false;
}

function sanitizeImportedTaskbarPrefs(input: unknown) {
  const parsed = input && typeof input === 'object' ? (input as any) : {};
  const bool = (key: string) => typeof parsed[key] === 'boolean';
  return {
    showCpu: bool('showCpu') ? parsed.showCpu : true,
    showCpuFreq: bool('showCpuFreq') ? parsed.showCpuFreq : true,
    showCpuTemp: bool('showCpuTemp') ? parsed.showCpuTemp : true,
    showGpu: bool('showGpu') ? parsed.showGpu : true,
    showGpuTemp: bool('showGpuTemp') ? parsed.showGpuTemp : true,
    showMemory: bool('showMemory') ? parsed.showMemory : true,
    showApp: bool('showApp') ? parsed.showApp : true,
    showDown: bool('showDown') ? parsed.showDown : true,
    showUp: bool('showUp') ? parsed.showUp : true,
    showLatency: bool('showLatency') ? parsed.showLatency : false,
    twoLineMode: bool('twoLineMode') ? parsed.twoLineMode : false
  };
}

function applyImportedOverlayPrefs(input: unknown) {
  const parsed = input && typeof input === 'object' ? (input as any) : {};
  const boolKeys: Array<keyof typeof prefs> = [
    'showCpu',
    'showGpu',
    'showMemory',
    'showDisk',
    'showDown',
    'showUp',
    'showLatency',
    'showValues',
    'showPercent',
    'showHardwareInfo',
    'showWarning',
    'showDragHandle'
  ];
  for (const key of boolKeys) {
    if (typeof parsed[key] === 'boolean') (prefs as any)[key] = parsed[key];
  }
  if (typeof parsed.backgroundOpacity === 'number' && Number.isFinite(parsed.backgroundOpacity)) {
    prefs.backgroundOpacity = Math.max(0, Math.min(100, Math.round(parsed.backgroundOpacity)));
  }
  if (parsed.backgroundImage === null || typeof parsed.backgroundImage === 'string') {
    prefs.backgroundImage = parsed.backgroundImage;
  }
  if (typeof parsed.backgroundBlurPx === 'number' && Number.isFinite(parsed.backgroundBlurPx)) {
    prefs.backgroundBlurPx = clampBlurPx(parsed.backgroundBlurPx);
  }
  if (parsed.backgroundEffect === 'gaussian' || parsed.backgroundEffect === 'liquidGlass') {
    prefs.backgroundEffect = normalizeBackgroundEffect(parsed.backgroundEffect);
  }
  if (typeof parsed.backgroundGlassStrength === 'number' && Number.isFinite(parsed.backgroundGlassStrength)) {
    prefs.backgroundGlassStrength = clampGlassStrength(parsed.backgroundGlassStrength);
  }
}

function isPositionLike(input: unknown): input is { x: number; y: number } {
  return (
    Boolean(input) &&
    typeof input === 'object' &&
    typeof (input as any).x === 'number' &&
    typeof (input as any).y === 'number' &&
    Number.isFinite((input as any).x) &&
    Number.isFinite((input as any).y)
  );
}

async function confirmImportConfig() {
  const raw = pendingImportConfig.value;
  importConfirmDialogOpen.value = false;
  pendingImportConfig.value = null;
  if (!raw || typeof window === 'undefined') return;

  try {
    const candidate = raw as any;

    // Settings
    const settings = candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : null;
    if (settings) {
      if (settings.language === 'zh-CN' || settings.language === 'en-US') store.setLanguage(settings.language);
      if (typeof settings.closeToTray === 'boolean') store.setCloseToTray(settings.closeToTray);
      if (typeof settings.rememberOverlayPosition === 'boolean')
        store.setRememberOverlayPosition(settings.rememberOverlayPosition);
      if (typeof settings.taskbarAlwaysOnTop === 'boolean')
        store.setTaskbarAlwaysOnTop(settings.taskbarAlwaysOnTop);
      if (settings.factoryResetHotkey == null || typeof settings.factoryResetHotkey === 'string')
        store.setFactoryResetHotkey(settings.factoryResetHotkey ?? null);
      if (typeof settings.taskbarMonitorEnabled === 'boolean')
        await store.setTaskbarMonitorEnabled(settings.taskbarMonitorEnabled);
      if (typeof settings.autoStartEnabled === 'boolean')
        await store.setAutoStartEnabled(settings.autoStartEnabled);
    }

    // Overlay prefs + themes
    applyImportedOverlayPrefs(candidate.overlayPrefs);
    const importedThemes = sanitizeThemes(candidate.overlayThemes ?? candidate.themes);
    if (importedThemes.length || Array.isArray(candidate.overlayThemes) || Array.isArray(candidate.themes)) {
      updateThemes(importedThemes.slice(0, 3));
    }

    // Refresh rate
    if (typeof candidate.refreshRateMs === 'number' && Number.isFinite(candidate.refreshRateMs)) {
      const nextRate = Math.max(100, Math.min(2000, Math.round(candidate.refreshRateMs)));
      refreshRate.value = nextRate;
      store.setRefreshRate(nextRate);
      localStorage.setItem('pulsecorelite.refresh_rate', String(nextRate));
    }

    // Taskbar prefs (localStorage)
    if (candidate.taskbarPrefs) {
      const next = sanitizeImportedTaskbarPrefs(candidate.taskbarPrefs);
      localStorage.setItem('pulsecorelite.taskbar_prefs', JSON.stringify(next));
    }

    // Positions (localStorage)
    if (isPositionLike(candidate.overlayPosition)) {
      localStorage.setItem('pulsecorelite.overlay_pos', JSON.stringify(candidate.overlayPosition));
    }
    if (isPositionLike(candidate.taskbarPosition)) {
      localStorage.setItem('pulsecorelite.taskbar_pos', JSON.stringify(candidate.taskbarPosition));
    }

    // Force taskbar window to pick up taskbar prefs (it only reads localStorage on mount).
    if (store.settings.taskbarMonitorEnabled) {
      await store.setTaskbarMonitorEnabled(false);
      await store.setTaskbarMonitorEnabled(true);
    }
  } catch {
    importErrorMessage.value = t('overlay.importConfigInvalid');
    importErrorDialogOpen.value = true;
  }
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
