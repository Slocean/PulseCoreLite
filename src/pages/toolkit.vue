<!-- @deprecated 此页面是独立弹出的 Toolkit 窗口（toolkit.html），主界面嵌入的工具 Tab 请看 src/components/toolkit/ToolkitEmbedded.vue -->
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
    <ToolkitGameSyncTab v-else-if="activeTab === 'game-sync'" @contentChange="handleContentChange" />
    <ToolkitHardwareTab v-else-if="activeTab === 'hardware'" @contentChange="handleContentChange" />
    <ToolkitAiTab v-else-if="activeTab === 'ai'" @contentChange="handleContentChange" />
    <ToolkitReminderTab v-else @contentChange="handleContentChange" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import ToolkitAiTab from '../components/toolkit/ToolkitAiTab.vue';
import ToolkitCleanupTab from '../components/toolkit/ToolkitCleanupTab.vue';
import ToolkitGameSyncTab from '../components/toolkit/ToolkitGameSyncTab.vue';
import ToolkitHardwareTab from '../components/toolkit/ToolkitHardwareTab.vue';
import ToolkitReminderTab from '../components/toolkit/ToolkitReminderTab.vue';
import ToolkitShutdownTab from '../components/toolkit/ToolkitShutdownTab.vue';
import ToolkitTabs from '../components/toolkit/ToolkitTabs.vue';
import { useOverlayPrefs } from '../composables/useOverlayPrefs';
import { useToolkitVisualLayer } from '../composables/useToolkitVisualLayer';
import { useToolkitWindowController } from '../composables/useToolkitWindowController';

type ToolkitTab = 'shutdown' | 'cleanup' | 'game-sync' | 'hardware' | 'ai' | 'reminder';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();
const activeTab = ref<ToolkitTab>('shutdown');
const pageRef = ref<HTMLElement | null>(null);

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'cleanup' as const, label: t('toolkit.tabCleanup') },
  { id: 'game-sync' as const, label: t('toolkit.tabGameSync') },
  { id: 'hardware' as const, label: t('toolkit.tabHardware') },
  { id: 'ai' as const, label: t('toolkit.tabAi') },
  { id: 'reminder' as const, label: t('toolkit.tabReminder') }
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
