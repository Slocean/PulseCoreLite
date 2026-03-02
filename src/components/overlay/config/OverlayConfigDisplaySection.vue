<template>
  <UiCheckbox v-model="prefs.showCpu">{{ t('overlay.showCpu') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showGpu">{{ t('overlay.showGpu') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showMemory">{{ t('overlay.showMemory') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showDisk">{{ t('overlay.showDisk') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showDown">{{ t('overlay.showDown') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showUp">{{ t('overlay.showUp') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showLatency">{{ t('overlay.showLatency') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showValues">{{ t('overlay.showValues') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showPercent">{{ t('overlay.showPercent') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showHardwareInfo">{{ t('overlay.showHardware') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showWarning">{{ t('overlay.showWarning') }}</UiCheckbox>
  <UiCheckbox v-model="prefs.showDragHandle">{{ t('overlay.showDragHandle') }}</UiCheckbox>

  <div class="overlay-config-range">
    <span class="overlay-config-label">{{ t('overlay.refreshRate') }}</span>
    <span class="overlay-config-value">{{ refreshRate }}ms</span>
    <input
      type="range"
      min="10"
      max="2000"
      step="10"
      v-model.number="refreshRate"
      @change="emit('refreshRateChange')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiCheckbox from '@/components/ui/Checkbox';
import type { OverlayPrefs } from '@/composables/useOverlayPrefs';

defineProps<{
  prefs: OverlayPrefs;
}>();

const refreshRate = defineModel<number>('refreshRate', { required: true });

const emit = defineEmits<{
  (e: 'refreshRateChange'): void;
}>();

const { t } = useI18n();
</script>
