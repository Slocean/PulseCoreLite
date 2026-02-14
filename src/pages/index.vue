<template>
  <section
    ref="overlayRef"
    class="overlay-widget overlay-widget--cyber"
    :style="overlayBackgroundStyle"
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
        :can-uninstall="store.installationMode === 'installed'"
        :app-version="appVersion"
        :language="store.settings.language"
        @setLanguage="setLanguage"
        @refreshRateChange="handleRefreshRateChange"
        @factoryReset="handleFactoryReset"
        @uninstall="handleUninstall"
        @openBackgroundDialog="openBackgroundDialog" />
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
      </div>
    </template>
    <template #actions>
      <button type="button" class="overlay-lang-button" @click="closeBackgroundDialog">
        {{ t('overlay.dialogCancel') }}
      </button>
      <button
        type="button"
        class="overlay-config-danger"
        :disabled="!canApplyBackground"
        @click="applyBackgroundCrop">
        {{ t('overlay.backgroundApply') }}
      </button>
    </template>
  </OverlayDialog>
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

const overlayBackgroundStyle = computed(() => {
  if (!prefs.backgroundImage) {
    return {};
  }
  return {
    backgroundImage: `url(${prefs.backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };
});

const canApplyBackground = computed(() => {
  return Boolean(backgroundImage.value && cropRect.width > 0 && cropRect.height > 0);
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
  backgroundFileName.value = '';
  if (prefs.backgroundImage) {
    backgroundImageSource.value = prefs.backgroundImage;
    void loadBackgroundImage(prefs.backgroundImage);
  } else {
    backgroundImageSource.value = null;
    backgroundImage.value = null;
  }
  nextTick(() => refreshCropAspect());
}

function closeBackgroundDialog() {
  backgroundDialogOpen.value = false;
  isDragging.value = false;
  handleCropMouseUp();
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
  ctx.drawImage(img, imageFit.offsetX, imageFit.offsetY, imageFit.drawWidth, imageFit.drawHeight);
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

function applyBackgroundCrop() {
  const img = backgroundImage.value;
  if (!img) {
    return;
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
    return;
  }
  ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, output.width, output.height);
  prefs.backgroundImage = output.toDataURL('image/png');
  closeBackgroundDialog();
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
