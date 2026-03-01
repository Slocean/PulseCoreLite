<template>
  <header>
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
        class="overlay-action overlay-action--info"
        native-type="button"
        variant="icon"
        @mousedown.stop
        @click="emit('minimize')"
        :title="t('overlay.minimizeToTray')">
        <span class="material-symbols-outlined">remove</span>
      </UiButton>
      <UiButton
        class="overlay-action overlay-action--primary"
        native-type="button"
        variant="icon"
        @mousedown.stop
        @click="emit('toggleConfig')"
        :title="t('overlay.configure')">
        <span class="material-symbols-outlined">settings</span>
      </UiButton>
      <UiButton
        class="overlay-action overlay-action--danger"
        native-type="button"
        variant="icon"
        @mousedown.stop
        @click="emit('close')"
        :title="t('overlay.close')">
        <span class="material-symbols-outlined">close</span>
      </UiButton>
    </div>
    <div class="overlay-meta">
      <UiButton
        native-type="button"
        class="version"
        variant="text"
        :class="{ 'version--update': updateAvailable }"
        :title="updateAvailable ? updateLabel : undefined"
        @click="handleVersionClick">
        v{{ appVersion }}
        <span v-if="updateAvailable" class="version-dot" aria-hidden="true"></span>
      </UiButton>
      <span class="usage">{{ appUsageLabel }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import UiButton from '@/components/ui/Button';

defineProps<{
  showDragHandle: boolean;
  appVersion: string;
  appUsageLabel: string;
  updateAvailable?: boolean;
  updateLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'startDrag'): void;
  (e: 'minimize'): void;
  (e: 'toggleConfig'): void;
  (e: 'close'): void;
  (e: 'versionClick'): void;
}>();

const { t } = useI18n();

function handleVersionClick() {
  emit('versionClick');
}
</script>

