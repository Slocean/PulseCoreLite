<template>
  <div class="overlay-config" @mousedown.stop>
    <div class="overlay-config-grid overlay-config-grid--3">
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
    </div>
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
      <input v-model="closeToTray" type="checkbox" />
      {{ t('overlay.closeToTray') }}
    </label>
    <label>
      <input v-model="autoStartEnabled" type="checkbox" />
      {{ t('overlay.autoStart') }}
    </label>
    <label>
      <input v-model="rememberOverlayPosition" type="checkbox" />
      {{ t('overlay.rememberPosition') }}
    </label>
    <div class="overlay-config-taskbar">
      <span class="overlay-config-label">{{ t('overlay.taskbarMonitor') }}</span>
      <label class="overlay-switch" :aria-label="t('overlay.taskbarMonitor')">
        <input v-model="taskbarMonitorEnabled" type="checkbox" role="switch" />
        <span class="overlay-switch-track" aria-hidden="true"></span>
      </label>
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
    <div class="overlay-config-range">
      <span class="overlay-config-label">{{ t('overlay.backgroundOpacity') }}</span>
      <span class="overlay-config-value">{{ backgroundOpacity }}%</span>
      <input type="range" min="0" max="100" step="5" v-model.number="backgroundOpacity" />
    </div>
    <div class="overlay-config-hotkey">
      <span class="overlay-config-label">{{ t('overlay.factoryResetHotkey') }}</span>
      <div class="overlay-config-hotkey-controls">
        <button type="button" class="overlay-lang-button" @click="beginHotkeyCapture">
          {{ recordingHotkey ? t('overlay.hotkeyRecording') : hotkeyLabel }}
        </button>
        <button
          type="button"
          class="overlay-lang-button"
          :disabled="factoryResetHotkey == null"
          @click="factoryResetHotkey = null">
          {{ t('overlay.hotkeyClear') }}
        </button>
        <button type="button" class="overlay-config-danger" @click="confirmFactoryReset">
          {{ t('overlay.factoryReset') }}
        </button>
      </div>
    </div>
    <!-- <div class="overlay-config-version">v{{ appVersion }}</div> -->
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { OverlayPrefs } from '../composables/useOverlayPrefs';
import { hotkeyFromEvent, hotkeyToString } from '../utils/hotkey';

defineProps<{
  appVersion: string;
  language: 'zh-CN' | 'en-US';
}>();

const prefs = defineModel<OverlayPrefs>('prefs', { required: true });
const closeToTray = defineModel<boolean>('closeToTray', { required: true });
const autoStartEnabled = defineModel<boolean>('autoStartEnabled', { required: true });
const rememberOverlayPosition = defineModel<boolean>('rememberOverlayPosition', { required: true });
const taskbarMonitorEnabled = defineModel<boolean>('taskbarMonitorEnabled', { required: true });
const factoryResetHotkey = defineModel<string | null>('factoryResetHotkey', { required: true });
const refreshRate = defineModel<number>('refreshRate', { required: true });
const backgroundOpacity = defineModel<number>('backgroundOpacity', { required: true });

const emit = defineEmits<{
  (e: 'setLanguage', value: 'zh-CN' | 'en-US'): void;
  (e: 'refreshRateChange'): void;
  (e: 'factoryReset'): void;
}>();

const { t } = useI18n();

const recordingHotkey = ref(false);
let hotkeyUnlisten: (() => void) | null = null;

const hotkeyLabel = computed(() => factoryResetHotkey.value ?? t('overlay.hotkeyNotSet'));

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

function confirmFactoryReset() {
  emit('factoryReset');
}

onUnmounted(() => {
  stopHotkeyCapture();
});
</script>
