<template>
  <section
    ref="pageRef"
    class="overlay-widget overlay-widget--cyber toolkit-page"
    @mousedown="handleToolkitMouseDown">
    <div v-if="prefs.backgroundImage" class="overlay-bg" :style="overlayBackgroundStyle" aria-hidden="true"></div>
    <div
      v-if="showLiquidGlassHighlight"
      class="overlay-bg overlay-bg--liquid-highlight"
      :style="overlayLiquidGlassHighlightStyle"
      aria-hidden="true"></div>

    <header class="toolkit-header">
      <div class="overlay-title toolkit-drag-region" data-tauri-drag-region>
        <h1 class="title">{{ t('toolkit.title') }}</h1>
      </div>
      <div class="overlay-header-actions">
        <div class="overlay-drag" @mousedown.stop="startDragging" :aria-label="t('overlay.showDragHandle')">
          <span class="material-symbols-outlined">drag_handle</span>
        </div>
        <UiButton
          native-type="button"
          preset="overlay-action-primary"
          :aria-label="t('overlay.minimizeToTray')"
          @click="minimizeToolkitWindow">
          <span class="material-symbols-outlined">remove</span>
        </UiButton>
        <UiButton
          native-type="button"
          preset="overlay-action-danger"
          :aria-label="t('overlay.close')"
          @click="closeToolkitWindow">
          <span class="material-symbols-outlined">close</span>
        </UiButton>
      </div>
    </header>

    <ToolkitTabs v-model="activeTab" :tabs="tabs" :aria-label="t('toolkit.tabs')" />

    <ToolkitShutdownTab v-if="activeTab === 'shutdown'" @contentChange="handleContentChange" />
    <ToolkitCleanupTab v-else-if="activeTab === 'cleanup'" @contentChange="handleContentChange" />
    <ToolkitHardwareTab v-else-if="activeTab === 'hardware'" @contentChange="handleContentChange" />
    <ToolkitReminderTab v-else-if="activeTab === 'reminder'" @contentChange="handleContentChange" />
    <ToolkitFeedbackTab v-else @contentChange="handleContentChange" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import ToolkitCleanupTab from '../components/toolkit/ToolkitCleanupTab.vue';
import ToolkitFeedbackTab from '../components/toolkit/ToolkitFeedbackTab.vue';
import ToolkitHardwareTab from '../components/toolkit/ToolkitHardwareTab.vue';
import ToolkitReminderTab from '../components/toolkit/ToolkitReminderTab.vue';
import ToolkitShutdownTab from '../components/toolkit/ToolkitShutdownTab.vue';
import ToolkitTabs from '../components/toolkit/ToolkitTabs.vue';
import { useOverlayPrefs } from '../composables/useOverlayPrefs';
import { useToolkitVisualLayer } from '../composables/useToolkitVisualLayer';
import { useToolkitWindowController } from '../composables/useToolkitWindowController';

type ToolkitTab = 'shutdown' | 'cleanup' | 'hardware' | 'reminder' | 'feedback';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();
const activeTab = ref<ToolkitTab>('shutdown');
const pageRef = ref<HTMLElement | null>(null);

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'cleanup' as const, label: t('toolkit.tabCleanup') },
  { id: 'hardware' as const, label: t('toolkit.tabHardware') },
  { id: 'reminder' as const, label: t('toolkit.tabReminder') },
  { id: 'feedback' as const, label: t('toolkit.tabFeedback') }
]);

const { overlayBackgroundStyle, showLiquidGlassHighlight, overlayLiquidGlassHighlightStyle } =
  useToolkitVisualLayer({
    prefs
  });
const {
  scheduleResize,
  notifyContentChange,
  handleToolkitMouseDown,
  startDragging,
  closeToolkitWindow,
  minimizeToolkitWindow
} = useToolkitWindowController({ pageRef });

watch(activeTab, () => {
  scheduleResize();
});

function handleContentChange() {
  notifyContentChange();
}
</script>
