<template>
  <header class="overlay-header-container">
    <div class="overlay-title">
      <div class="badge">
        {{ t('overlay.badge') }}
      </div>
      <span>
        <span class="title">{{ t('overlay.title') }}</span>
      </span>
    </div>
    <div class="overlay-header-actions">
      <div v-if="showDragHandle" class="overlay-drag" @mousedown.stop="emit('startDrag')">
        <span class="material-symbols-outlined">drag_handle</span>
      </div>
      <UiButton
        native-type="button"
        preset="overlay-action-info"
        @mousedown.stop
        @click="emit('minimize')"
        :title="t('overlay.minimizeToTray')">
        <span class="material-symbols-outlined">remove</span>
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-action-primary"
        @mousedown.stop
        @click="emit('toggleTabs')"
        :title="resolvedTabsExpanded ? t('overlay.mainTabsCollapse') : t('overlay.mainTabsExpand')">
        <span class="material-symbols-outlined">{{ resolvedTabsExpanded ? 'expand_less' : 'expand_more' }}</span>
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-action-danger"
        @mousedown.stop
        @click="emit('close')"
        :title="t('overlay.close')">
        <span class="material-symbols-outlined">close</span>
      </UiButton>
    </div>
    <div class="overlay-meta">
      <OverlayVersionButton
        :app-version="appVersion"
        :update-available="updateAvailable"
        :update-label="updateLabel"
        @click="emit('versionClick')" />
      <span class="usage">{{ appUsageLabel }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import UiButton from '@/components/ui/Button';
import OverlayVersionButton from '@/components/overlay/OverlayVersionButton.vue';

const props = defineProps<{
  showDragHandle: boolean;
  appVersion: string;
  appUsageLabel: string;
  updateAvailable?: boolean;
  updateLabel?: string;
  tabsExpanded?: boolean;
}>();

const resolvedTabsExpanded = computed(() => props.tabsExpanded ?? true);

const emit = defineEmits<{
  (e: 'startDrag'): void;
  (e: 'minimize'): void;
  (e: 'toggleTabs'): void;
  (e: 'close'): void;
  (e: 'versionClick'): void;
}>();

const { t } = useI18n();
</script>
<style lang="css" scoped>
.overlay-header-container {
  margin-bottom: 15px;
}
</style>
