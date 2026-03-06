<template>
  <UiCheckbox v-model="autoStartEnabled">{{ t('overlay.autoStart') }}</UiCheckbox>
  <UiCheckbox v-model="memoryTrimEnabled">{{ t('overlay.memoryTrim') }}</UiCheckbox>
  <UiCheckbox v-model="rememberOverlayPosition">{{ t('overlay.rememberPosition') }}</UiCheckbox>
  <UiCheckbox v-model="overlayAlwaysOnTop">{{ t('overlay.mainWindowAlwaysOnTop') }}</UiCheckbox>

  <div class="overlay-config-row">
    <UiCheckbox v-model="closeToTray">{{ t('overlay.closeToTray') }}</UiCheckbox>
    <div class="overlay-config-taskbar overlay-config-taskbar--compact">
      <span class="overlay-config-label">{{ t('overlay.taskbarMonitor') }}</span>
      <UiSwitch v-model="taskbarMonitorEnabled" :aria-label="t('overlay.taskbarMonitor')" />
    </div>
  </div>

  <div class="overlay-config-row">
    <UiCheckbox v-model="nativeTaskbarMonitorEnabled">{{ t('overlay.nativeTaskbarMonitor') }}</UiCheckbox>
  </div>

  <div class="overlay-config-language">
    <span class="overlay-config-label">{{ t('overlay.language') }}</span>
    <div class="overlay-lang-buttons">
      <UiButton
        native-type="button"
        preset="overlay-chip"
        :active="language === 'zh-CN'"
        @click="emit('setLanguage', 'zh-CN')">
        {{ t('overlay.langZh') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-chip"
        :active="language === 'en-US'"
        @click="emit('setLanguage', 'en-US')">
        {{ t('overlay.langEn') }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCheckbox from '@/components/ui/Checkbox';
import UiSwitch from '@/components/ui/Switch';

defineProps<{
  language: 'zh-CN' | 'en-US';
}>();

const autoStartEnabled = defineModel<boolean>('autoStartEnabled', { required: true });
const memoryTrimEnabled = defineModel<boolean>('memoryTrimEnabled', { required: true });
const rememberOverlayPosition = defineModel<boolean>('rememberOverlayPosition', { required: true });
const overlayAlwaysOnTop = defineModel<boolean>('overlayAlwaysOnTop', { required: true });
const closeToTray = defineModel<boolean>('closeToTray', { required: true });
const taskbarMonitorEnabled = defineModel<boolean>('taskbarMonitorEnabled', { required: true });
const nativeTaskbarMonitorEnabled = defineModel<boolean>('nativeTaskbarMonitorEnabled', { required: true });

const emit = defineEmits<{
  (e: 'setLanguage', value: 'zh-CN' | 'en-US'): void;
}>();

const { t } = useI18n();
</script>
