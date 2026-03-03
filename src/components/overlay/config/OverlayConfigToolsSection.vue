<template>
  <div class="overlay-config-duo">
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.update') }}</span>
      <div class="overlay-lang-buttons">
        <UiButton native-type="button" preset="overlay-chip" :disabled="checkingUpdate" @click="emit('checkUpdate')">
          {{ checkingUpdate ? t('overlay.updateChecking') : t('overlay.checkUpdate') }}
        </UiButton>
      </div>
    </div>
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.configTransfer') }}</span>
      <div class="overlay-lang-buttons">
        <UiButton native-type="button" preset="overlay-chip" @click="emit('exportConfig')">
          {{ t('overlay.exportConfig') }}
        </UiButton>
        <UiButton native-type="button" preset="overlay-chip" @click="triggerImport">
          {{ t('overlay.importConfig') }}
        </UiButton>
      </div>
      <input
        ref="importFileInput"
        class="overlay-upload-input"
        type="file"
        accept="application/json"
        @change="handleImportChange" />
    </div>
  </div>

  <div class="overlay-config-duo">
    <div class="overlay-config-hotkey">
      <span class="overlay-config-label">{{ t('overlay.factoryResetHotkey') }}</span>
      <div class="overlay-config-hotkey-controls">
        <div class="overlay-hotkey-chip">
          <UiButton native-type="button" preset="overlay-chip" @click="beginHotkeyCapture">
            {{ recordingHotkey ? t('overlay.hotkeyRecording') : hotkeyLabel }}
          </UiButton>
          <CornerAction
            v-if="factoryResetHotkey != null && !recordingHotkey"
            preset="overlay-corner-danger"
            icon="close"
            :ariaLabel="t('overlay.hotkeyClear')"
            @click="requestClearHotkey" />
        </div>
        <UiButton native-type="button" preset="overlay-danger" @click="emit('factoryReset')">
          {{ t('overlay.factoryReset') }}
        </UiButton>
      </div>
    </div>
    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.toolkit') }}</span>
      <UiSwitch :model-value="toolkitSwitchOn" :aria-label="t('overlay.toolkit')" @update:model-value="handleToolkitToggle" />
    </div>
  </div>

  <div v-if="showUninstall && canUninstall" class="overlay-config-uninstall">
    <UiButton native-type="button" preset="overlay-danger" @click="emit('uninstall')">
      {{ t('overlay.uninstall') }}
    </UiButton>
  </div>

  <UiDialog
    v-model:open="hotkeyClearDialogOpen"
    :title="t('overlay.hotkeyClearTitle')"
    :message="t('overlay.hotkeyClearMessage')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmClearHotkey"
    @cancel="closeClearHotkeyDialog" />
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import CornerAction from '@/components/overlay/CornerAction.vue';
import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
import UiSwitch from '@/components/ui/Switch';
import { hotkeyFromEvent, hotkeyToString } from '../../../utils/hotkey';

withDefaults(
  defineProps<{
    checkingUpdate: boolean;
    toolkitSwitchOn: boolean;
    canUninstall: boolean;
    showUninstall?: boolean;
  }>(),
  {
    showUninstall: false
  }
);

const emit = defineEmits<{
  (e: 'checkUpdate'): void;
  (e: 'exportConfig'): void;
  (e: 'importConfig', value: File): void;
  (e: 'factoryReset'): void;
  (e: 'openToolkit', value: boolean): void;
  (e: 'uninstall'): void;
}>();

const factoryResetHotkey = defineModel<string | null>('factoryResetHotkey', { required: true });

const importFileInput = ref<HTMLInputElement | null>(null);
const { t } = useI18n();
const recordingHotkey = ref(false);
let hotkeyUnlisten: (() => void) | null = null;
const hotkeyClearDialogOpen = ref(false);

const hotkeyLabel = computed(() => factoryResetHotkey.value ?? t('overlay.hotkeyNotSet'));

function triggerImport() {
  importFileInput.value?.click();
}

function handleToolkitToggle(enabled: boolean) {
  emit('openToolkit', enabled);
}

function handleImportChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;
  emit('importConfig', file);
}

function stopHotkeyCapture() {
  if (hotkeyUnlisten) {
    hotkeyUnlisten();
    hotkeyUnlisten = null;
  }
  recordingHotkey.value = false;
}

function beginHotkeyCapture() {
  if (typeof window === 'undefined') {
    return;
  }
  if (recordingHotkey.value) {
    stopHotkeyCapture();
    return;
  }

  recordingHotkey.value = true;
  const handler = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key === 'Escape') {
      stopHotkeyCapture();
      return;
    }

    const hotkey = hotkeyFromEvent(event);
    if (!hotkey) {
      return;
    }
    factoryResetHotkey.value = hotkeyToString(hotkey);
    stopHotkeyCapture();
  };

  window.addEventListener('keydown', handler, true);
  hotkeyUnlisten = () => window.removeEventListener('keydown', handler, true);
}

function requestClearHotkey() {
  if (factoryResetHotkey.value == null) return;
  hotkeyClearDialogOpen.value = true;
}

function closeClearHotkeyDialog() {
  hotkeyClearDialogOpen.value = false;
}

function confirmClearHotkey() {
  factoryResetHotkey.value = null;
  closeClearHotkeyDialog();
}

onUnmounted(() => {
  stopHotkeyCapture();
});
</script>
