<template>
  <div class="overlay-config-wrap">
    <UiCollapsiblePanel
      v-model="displaySectionOpen"
      class="overlay-config overlay-config-section"
      :title="t('overlay.settingsSectionDisplay')"
      :framed="true"
      single-header-preset="toolkit-collapse"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      content-class="overlay-config-content"
      @mousedown.stop>
      <OverlayConfigDisplaySection
        :prefs="prefs"
        v-model:refresh-rate="refreshRate"
        @refresh-rate-change="emit('refreshRateChange')" />
    </UiCollapsiblePanel>

    <UiCollapsiblePanel
      v-model="systemSectionOpen"
      class="overlay-config overlay-config-section"
      :title="t('overlay.settingsSectionSystem')"
      :framed="true"
      single-header-preset="toolkit-collapse"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      content-class="overlay-config-content"
      @mousedown.stop>
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
    </UiCollapsiblePanel>

    <UiCollapsiblePanel
      v-model="themeSectionOpen"
      class="overlay-config overlay-config-section"
      :title="t('overlay.settingsSectionTheme')"
      :framed="true"
      single-header-preset="toolkit-collapse"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      content-class="overlay-config-content overlay-config--single-column"
      @mousedown.stop>
      <OverlayConfigThemeSection
        :prefs="prefs"
        :system-themes="props.systemThemes"
        :themes="props.themes"
        :get-theme-preview-url="getThemePreviewUrl"
        v-model:background-opacity="backgroundOpacity"
        @open-background-dialog="emit('openBackgroundDialog')"
        @delete-theme="emit('deleteTheme', $event)"
        @edit-theme="emit('editTheme', $event)" />
    </UiCollapsiblePanel>

    <UiCollapsiblePanel
      v-model="toolsSectionOpen"
      class="overlay-config overlay-config-section"
      :title="t('overlay.settingsSectionTools')"
      :framed="true"
      single-header-preset="toolkit-collapse"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      content-class="overlay-config-content overlay-config--single-column"
      @mousedown.stop>
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

    <UiCollapsiblePanel
      v-model="feedbackSectionOpen"
      class="overlay-config overlay-config-section"
      :title="t('overlay.settingsSectionFeedback')"
      :framed="true"
      single-header-preset="toolkit-collapse"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      content-class="overlay-config-content overlay-config--single-column"
      @mousedown.stop>
      <OverlayConfigFeedbackSection
        :app-version="appVersion"
        :language="language"
        toast-channel="overlay" />
    </UiCollapsiblePanel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigDisplaySection from '@/components/overlay/config/OverlayConfigDisplaySection.vue';
import OverlayConfigFeedbackSection from '@/components/overlay/config/OverlayConfigFeedbackSection.vue';
import OverlayConfigSystemSection from '@/components/overlay/config/OverlayConfigSystemSection.vue';
import OverlayConfigThemeSection from '@/components/overlay/config/OverlayConfigThemeSection.vue';
import OverlayConfigToolsSection from '@/components/overlay/config/OverlayConfigToolsSection.vue';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { OverlayTheme } from '@/components/overlay/config/types';
import type { OverlayPrefs } from '../composables/useOverlayPrefs';

const props = defineProps<{
  appVersion: string;
  language: 'zh-CN' | 'en-US';
  canUninstall: boolean;
  systemThemes: OverlayTheme[];
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

const { t } = useI18n();

const displaySectionOpen = ref(true);
const systemSectionOpen = ref(true);
const themeSectionOpen = ref(true);
const toolsSectionOpen = ref(true);
const feedbackSectionOpen = ref(false);

const toolkitSwitchOn = computed(() => props.toolkitState !== 'closed');

function confirmFactoryReset() {
  emit('factoryReset');
}

function handleToolkitToggle(enabled: boolean) {
  emit('openToolkit', enabled);
}
</script>
