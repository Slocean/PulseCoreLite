<template>
  <div class="toolkit-page toolkit-page--embedded">
    <header class="toolkit-header">
      <div class="toolkit-embedded-title">
        <h2 class="title">{{ t('toolkit.title') }}</h2>
      </div>
      <div class="overlay-header-actions">
        <UiButton
          native-type="button"
          preset="overlay-action-info"
          :aria-label="t('overlay.openToolkit')"
          :title="t('overlay.openToolkit')"
          @click="emit('openStandalone')">
          <span class="material-symbols-outlined">open_in_new</span>
        </UiButton>
      </div>
    </header>

    <ToolkitTabs v-model="activeTab" :tabs="tabs" :aria-label="t('toolkit.tabs')" />

    <ToolkitShutdownTab v-if="activeTab === 'shutdown'" @contentChange="handleContentChange" />
    <ToolkitCleanupTab v-else-if="activeTab === 'cleanup'" @contentChange="handleContentChange" />
    <ToolkitHardwareTab v-else-if="activeTab === 'hardware'" @contentChange="handleContentChange" />
    <ToolkitReminderTab v-else @contentChange="handleContentChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import ToolkitCleanupTab from './ToolkitCleanupTab.vue';
import ToolkitHardwareTab from './ToolkitHardwareTab.vue';
import ToolkitReminderTab from './ToolkitReminderTab.vue';
import ToolkitShutdownTab from './ToolkitShutdownTab.vue';
import ToolkitTabs from './ToolkitTabs.vue';

type ToolkitTab = 'shutdown' | 'cleanup' | 'hardware' | 'reminder';

const emit = defineEmits<{
  (event: 'openStandalone'): void;
}>();

const { t } = useI18n();
const activeTab = ref<ToolkitTab>('shutdown');

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'cleanup' as const, label: t('toolkit.tabCleanup') },
  { id: 'hardware' as const, label: t('toolkit.tabHardware') },
  { id: 'reminder' as const, label: t('toolkit.tabReminder') }
]);

function handleContentChange() {
  // Embedded toolkit doesn't need window-resize signals.
}
</script>

<style scoped lang="css">
.toolkit-embedded-title {
  display: flex;
  align-items: center;
  min-height: 30px;
  min-width: 0;
}

.toolkit-embedded-title .title {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.16em;
  font-size: 13px;
  font-weight: 700;
}

.toolkit-page--embedded {
  background: transparent;
}
</style>
