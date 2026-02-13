<template>
  <div class="overlay-config" @mousedown.stop>
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
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        v-model.number="backgroundOpacity" />
    </div>
    <div class="overlay-config-version">v{{ appVersion }}</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { OverlayPrefs } from '../composables/useOverlayPrefs';

defineProps<{
  appVersion: string;
  language: 'zh-CN' | 'en-US';
}>();

const prefs = defineModel<OverlayPrefs>('prefs', { required: true });
const closeToTray = defineModel<boolean>('closeToTray', { required: true });
const refreshRate = defineModel<number>('refreshRate', { required: true });
const backgroundOpacity = defineModel<number>('backgroundOpacity', { required: true });

const emit = defineEmits<{
  (e: 'setLanguage', value: 'zh-CN' | 'en-US'): void;
  (e: 'refreshRateChange'): void;
}>();

const { t } = useI18n();
</script>
