<template>
  <div class="overlay-config" @mousedown.stop>
    <!-- <div class="overlay-config-grid overlay-config-grid--3"> -->
    <label>
      <input v-model="prefs.showCpu" type="checkbox" />
      {{ t('overlay.showCpu') }}
    </label>
    <label>
      <input v-model="prefs.showGpu" type="checkbox" />
      {{ t('overlay.showGpu') }}
    </label>
    <label>
      <input v-model="prefs.showMemory" type="checkbox" />
      {{ t('overlay.showMemory') }}
    </label>
    <label>
      <input v-model="prefs.showDisk" type="checkbox" />
      {{ t('overlay.showDisk') }}
    </label>
    <label>
      <input v-model="prefs.showDown" type="checkbox" />
      {{ t('overlay.showDown') }}
    </label>
    <label>
      <input v-model="prefs.showUp" type="checkbox" />
      {{ t('overlay.showUp') }}
    </label>
    <!-- </div> -->
    <label>
      <input v-model="prefs.showLatency" type="checkbox" />
      {{ t('overlay.showLatency') }}
    </label>
    <label>
      <input v-model="prefs.showValues" type="checkbox" />
      {{ t('overlay.showValues') }}
    </label>
    <label>
      <input v-model="prefs.showPercent" type="checkbox" />
      {{ t('overlay.showPercent') }}
    </label>
    <label>
      <input v-model="prefs.showHardwareInfo" type="checkbox" />
      {{ t('overlay.showHardware') }}
    </label>
    <label>
      <input v-model="prefs.showWarning" type="checkbox" />
      {{ t('overlay.showWarning') }}
    </label>
    <label>
      <input v-model="prefs.showDragHandle" type="checkbox" />
      {{ t('overlay.showDragHandle') }}
    </label>

    <label>
      <input v-model="autoStartEnabled" type="checkbox" />
      {{ t('overlay.autoStart') }}
    </label>
    <label>
      <input v-model="rememberOverlayPosition" type="checkbox" />
      {{ t('overlay.rememberPosition') }}
    </label>
    <label>
      <input v-model="overlayAlwaysOnTop" type="checkbox" />
      {{ t('overlay.mainWindowAlwaysOnTop') }}
    </label>
    <div class="overlay-config-row">
      <label class="overlay-config-inline">
        <input v-model="closeToTray" type="checkbox" />
        {{ t('overlay.closeToTray') }}
      </label>
      <div class="overlay-config-taskbar overlay-config-taskbar--compact">
        <span class="overlay-config-label">{{ t('overlay.taskbarMonitor') }}</span>
        <label class="overlay-switch" :aria-label="t('overlay.taskbarMonitor')">
          <input v-model="taskbarMonitorEnabled" type="checkbox" role="switch" />
          <span class="overlay-switch-track" aria-hidden="true"></span>
        </label>
      </div>
    </div>
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.language') }}</span>
      <div class="overlay-lang-buttons">
        <button
          type="button"
          class="overlay-lang-button"
          :class="{ 'overlay-lang-button--active': language === 'zh-CN' }"
          @click="emit('setLanguage', 'zh-CN')">
          {{ t('overlay.langZh') }}
        </button>
        <button
          type="button"
          class="overlay-lang-button"
          :class="{ 'overlay-lang-button--active': language === 'en-US' }"
          @click="emit('setLanguage', 'en-US')">
          {{ t('overlay.langEn') }}
        </button>
      </div>
    </div>
    <div class="overlay-config-range">
      <span class="overlay-config-label">{{ t('overlay.refreshRate') }}</span>
      <span class="overlay-config-value">{{ refreshRate }}ms</span>
      <input
        type="range"
        min="100"
        max="2000"
        step="100"
        v-model.number="refreshRate"
        @change="emit('refreshRateChange')" />
    </div>
    <div v-if="!prefs.backgroundImage" class="overlay-config-range">
      <span class="overlay-config-label">{{ t('overlay.backgroundOpacity') }}</span>
      <span class="overlay-config-value">{{ backgroundOpacity }}%</span>
      <input type="range" min="0" max="100" step="5" v-model.number="backgroundOpacity" />
    </div>
    <div class="overlay-config-item--wide overlay-config-action">
      <div class="overlay-config-theme">
        <span class="overlay-config-label">{{ t('overlay.backgroundImage') }}</span>
        <div class="overlay-lang-buttons overlay-config-theme-tabs">
          <button
            type="button"
            class="overlay-lang-button"
            :class="{ 'overlay-lang-button--active': isDefaultTheme }"
            @click="selectDefaultTheme">
            {{ t('overlay.themeDefault') }}
          </button>
          <div class="overlay-theme-list">
            <div
              v-for="theme in themes"
              :key="theme.id"
              class="overlay-theme-chip"
              :class="{ 'overlay-theme-chip--active': isThemeActive(theme) }"
              :data-name="theme.name"
              @click="selectTheme(theme)">
              <!-- @contextmenu.prevent.stop="emit('editTheme', theme.id)" -->
              <!-- <span class="overlay-theme-name">{{ theme.name }}</span> -->
              <span class="overlay-theme-thumb" :style="{ backgroundImage: `url(${theme.image})` }"></span>
              <OverlayCornerDelete :ariaLabel="t('overlay.themeDelete')" @click="emit('deleteTheme', theme.id)" />
              <button
                type="button"
                class="overlay-corner-edit"
                :aria-label="t('overlay.themeEditTitle')"
                @click.stop="emit('editTheme', theme.id)"
                @contextmenu.prevent.stop>
                <span class="material-symbols-outlined">edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="overlay-lang-button"
        :disabled="!canAddTheme"
        @click="emit('openBackgroundDialog')">
        {{ t('overlay.backgroundImageButton') }}
      </button>
    </div>
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.configTransfer') }}</span>
      <div class="overlay-lang-buttons">
        <button type="button" class="overlay-lang-button" @click="emit('exportConfig')">
          {{ t('overlay.exportConfig') }}
        </button>
        <button type="button" class="overlay-lang-button" @click="triggerImport">
          {{ t('overlay.importConfig') }}
        </button>
      </div>
      <input
        ref="importFileInput"
        class="overlay-upload-input"
        type="file"
        accept="application/json"
        @change="handleImportChange" />
    </div>
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.toolkit') }}</span>
      <div class="overlay-lang-buttons">
        <button type="button" class="overlay-lang-button" @click="emit('openToolkit')">
          {{ toolkitActionLabel }}
        </button>
      </div>
    </div>
    <div class="overlay-config-hotkey">
      <span class="overlay-config-label">{{ t('overlay.factoryResetHotkey') }}</span>
      <div class="overlay-config-hotkey-controls">
        <div class="overlay-hotkey-chip">
          <button type="button" class="overlay-lang-button" @click="beginHotkeyCapture">
            {{ recordingHotkey ? t('overlay.hotkeyRecording') : hotkeyLabel }}
          </button>
          <OverlayCornerDelete
            v-if="factoryResetHotkey != null && !recordingHotkey"
            :ariaLabel="t('overlay.hotkeyClear')"
            @click="requestClearHotkey" />
        </div>
        <button type="button" class="overlay-config-danger" @click="confirmFactoryReset">
          {{ t('overlay.factoryReset') }}
        </button>
      </div>
    </div>
    <div v-if="false && canUninstall" class="overlay-config-uninstall">
      <button type="button" class="overlay-config-danger" @click="emit('uninstall')">
        {{ t('overlay.uninstall') }}
      </button>
    </div>
    <!-- <div class="overlay-config-version">v{{ appVersion }}</div> -->
  </div>

  <OverlayDialog
    v-model:open="hotkeyClearDialogOpen"
    :title="t('overlay.hotkeyClearTitle')"
    :message="t('overlay.hotkeyClearMessage')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmClearHotkey"
    @cancel="closeClearHotkeyDialog" />
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayCornerDelete from './OverlayCornerDelete.vue';
import OverlayDialog from './OverlayDialog.vue';
import type { OverlayBackgroundEffect, OverlayPrefs } from '../composables/useOverlayPrefs';
import { DEFAULT_BACKGROUND_EFFECT, DEFAULT_BACKGROUND_GLASS_STRENGTH } from '../composables/useOverlayPrefs';
import { hotkeyFromEvent, hotkeyToString } from '../utils/hotkey';

type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
};

const props = defineProps<{
  appVersion: string;
  language: 'zh-CN' | 'en-US';
  canUninstall: boolean;
  themes: OverlayTheme[];
  toolkitState: 'closed' | 'open' | 'hidden';
}>();

const prefs = defineModel<OverlayPrefs>('prefs', { required: true });
const closeToTray = defineModel<boolean>('closeToTray', { required: true });
const autoStartEnabled = defineModel<boolean>('autoStartEnabled', { required: true });
const rememberOverlayPosition = defineModel<boolean>('rememberOverlayPosition', { required: true });
const overlayAlwaysOnTop = defineModel<boolean>('overlayAlwaysOnTop', { required: true });
const taskbarMonitorEnabled = defineModel<boolean>('taskbarMonitorEnabled', { required: true });
const factoryResetHotkey = defineModel<string | null>('factoryResetHotkey', { required: true });
const refreshRate = defineModel<number>('refreshRate', { required: true });
const backgroundOpacity = defineModel<number>('backgroundOpacity', { required: true });

const emit = defineEmits<{
  (e: 'setLanguage', value: 'zh-CN' | 'en-US'): void;
  (e: 'refreshRateChange'): void;
  (e: 'factoryReset'): void;
  (e: 'uninstall'): void;
  (e: 'openBackgroundDialog'): void;
  (e: 'deleteTheme', value: string): void;
  (e: 'editTheme', value: string): void;
  (e: 'exportConfig'): void;
  (e: 'importConfig', value: File): void;
  (e: 'openToolkit'): void;
}>();

const { t } = useI18n();

const recordingHotkey = ref(false);
let hotkeyUnlisten: (() => void) | null = null;
const hotkeyClearDialogOpen = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);

const hotkeyLabel = computed(() => factoryResetHotkey.value ?? t('overlay.hotkeyNotSet'));
const isDefaultTheme = computed(() => !prefs.value.backgroundImage);
const themes = computed(() => props.themes);
const toolkitActionLabel = computed(() => (props.toolkitState === 'open' ? t('overlay.closeToolkit') : t('overlay.showToolkit')));

function stopHotkeyCapture() {
  if (hotkeyUnlisten) {
    hotkeyUnlisten();
    hotkeyUnlisten = null;
  }
  recordingHotkey.value = false;
}

function beginHotkeyCapture() {
  if (typeof window === 'undefined') {
    return;
  }
  if (recordingHotkey.value) {
    stopHotkeyCapture();
    return;
  }

  recordingHotkey.value = true;
  const handler = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key === 'Escape') {
      stopHotkeyCapture();
      return;
    }

    const hotkey = hotkeyFromEvent(event);
    if (!hotkey) {
      return;
    }
    factoryResetHotkey.value = hotkeyToString(hotkey);
    stopHotkeyCapture();
  };

  window.addEventListener('keydown', handler, true);
  hotkeyUnlisten = () => window.removeEventListener('keydown', handler, true);
}

function selectDefaultTheme() {
  if (
    !prefs.value.backgroundImage &&
    prefs.value.backgroundBlurPx === 0 &&
    prefs.value.backgroundEffect === DEFAULT_BACKGROUND_EFFECT &&
    prefs.value.backgroundGlassStrength === DEFAULT_BACKGROUND_GLASS_STRENGTH
  ) {
    return;
  }
  prefs.value.backgroundImage = null;
  prefs.value.backgroundBlurPx = 0;
  prefs.value.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
  prefs.value.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function selectTheme(theme: OverlayTheme) {
  if (
    prefs.value.backgroundImage === theme.image &&
    prefs.value.backgroundBlurPx === theme.blurPx &&
    prefs.value.backgroundEffect === theme.effect &&
    prefs.value.backgroundGlassStrength === theme.glassStrength
  ) {
    return;
  }
  prefs.value.backgroundImage = theme.image;
  prefs.value.backgroundBlurPx = theme.blurPx;
  prefs.value.backgroundEffect = theme.effect;
  prefs.value.backgroundGlassStrength = theme.glassStrength;
}

function isThemeActive(theme: OverlayTheme) {
  return (
    prefs.value.backgroundImage === theme.image &&
    prefs.value.backgroundBlurPx === theme.blurPx &&
    prefs.value.backgroundEffect === theme.effect &&
    prefs.value.backgroundGlassStrength === theme.glassStrength
  );
}

const canAddTheme = computed(() => props.themes.length < 3);

function confirmFactoryReset() {
  emit('factoryReset');
}

function requestClearHotkey() {
  if (factoryResetHotkey.value == null) return;
  hotkeyClearDialogOpen.value = true;
}

function closeClearHotkeyDialog() {
  hotkeyClearDialogOpen.value = false;
}

function confirmClearHotkey() {
  factoryResetHotkey.value = null;
  closeClearHotkeyDialog();
}

function triggerImport() {
  importFileInput.value?.click();
}

function handleImportChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;
  emit('importConfig', file);
}

onUnmounted(() => {
  stopHotkeyCapture();
});
</script>
