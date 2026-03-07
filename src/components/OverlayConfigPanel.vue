<template>
  <div class="overlay-config-wrap">
    <UiCollapsiblePanel
      class="overlay-config"
      title=""
      :framed="true"
      :collapsible="false"
      content-class="overlay-config-content"
      title-class="overlay-config-panel-title-hidden"
      @mousedown.stop>
      <OverlayConfigDisplaySection
        :prefs="prefs"
        v-model:refresh-rate="refreshRate"
        @refresh-rate-change="emit('refreshRateChange')" />

      <OverlayConfigSystemSection
        :language="language"
        v-model:auto-start-enabled="autoStartEnabled"
        v-model:memory-trim-enabled="memoryTrimEnabled"
        v-model:remember-overlay-position="rememberOverlayPosition"
        v-model:overlay-always-on-top="overlayAlwaysOnTop"
        v-model:close-to-tray="closeToTray"
        v-model:taskbar-monitor-enabled="taskbarMonitorEnabled"
        v-model:native-taskbar-monitor-enabled="nativeTaskbarMonitorEnabled"
        @set-language="emit('setLanguage', $event)" />

      <OverlayConfigThemeSection
        :prefs="prefs"
        :themes="props.themes"
        :get-theme-preview-url="getThemePreviewUrl"
        v-model:background-opacity="backgroundOpacity"
        @open-background-dialog="emit('openBackgroundDialog')"
        @delete-theme="emit('deleteTheme', $event)"
        @edit-theme="emit('editTheme', $event)" />

      <OverlayConfigToolsSection
        :checking-update="checkingUpdate"
        v-model:factory-reset-hotkey="factoryResetHotkey"
        :toolkit-switch-on="toolkitSwitchOn"
        :can-uninstall="canUninstall"
        @check-update="emit('checkUpdate')"
        @export-config="emit('exportConfig')"
        @import-config="emit('importConfig', $event)"
        @factory-reset="confirmFactoryReset"
        @open-toolkit="handleToolkitToggle"
        @uninstall="emit('uninstall')" />

    </UiCollapsiblePanel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import OverlayConfigDisplaySection from '@/components/overlay/config/OverlayConfigDisplaySection.vue';
import OverlayConfigSystemSection from '@/components/overlay/config/OverlayConfigSystemSection.vue';
import OverlayConfigThemeSection from '@/components/overlay/config/OverlayConfigThemeSection.vue';
import OverlayConfigToolsSection from '@/components/overlay/config/OverlayConfigToolsSection.vue';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { OverlayPrefs } from '../composables/useOverlayPrefs';
import type { OverlayTheme } from '@/components/overlay/config/types';

const props = defineProps<{
  language: 'zh-CN' | 'en-US';
  canUninstall: boolean;
  themes: OverlayTheme[];
  getThemePreviewUrl: (theme: OverlayTheme) => string;
  toolkitState: 'closed' | 'open' | 'hidden';
  checkingUpdate: boolean;
}>();

const prefs = defineModel<OverlayPrefs>('prefs', { required: true });
const closeToTray = defineModel<boolean>('closeToTray', { required: true });
const autoStartEnabled = defineModel<boolean>('autoStartEnabled', { required: true });
const memoryTrimEnabled = defineModel<boolean>('memoryTrimEnabled', { required: true });
const rememberOverlayPosition = defineModel<boolean>('rememberOverlayPosition', { required: true });
const overlayAlwaysOnTop = defineModel<boolean>('overlayAlwaysOnTop', { required: true });
const taskbarMonitorEnabled = defineModel<boolean>('taskbarMonitorEnabled', { required: true });
const nativeTaskbarMonitorEnabled = defineModel<boolean>('nativeTaskbarMonitorEnabled', { required: true });
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
  (e: 'openToolkit', value: boolean): void;
  (e: 'checkUpdate'): void;
}>();

const toolkitSwitchOn = computed(() => props.toolkitState !== 'closed');

function confirmFactoryReset() {
  emit('factoryReset');
}

function handleToolkitToggle(enabled: boolean) {
  emit('openToolkit', enabled);
}
</script>
