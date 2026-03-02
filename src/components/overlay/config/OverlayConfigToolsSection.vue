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
          <UiButton native-type="button" preset="overlay-chip" @click="emit('beginHotkeyCapture')">
            {{ recordingHotkey ? t('overlay.hotkeyRecording') : hotkeyLabel }}
          </UiButton>
          <CornerAction
            v-if="factoryResetHotkey != null && !recordingHotkey"
            preset="overlay-corner-danger"
            icon="close"
            :ariaLabel="t('overlay.hotkeyClear')"
            @click="emit('requestClearHotkey')" />
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
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import CornerAction from '@/components/overlay/CornerAction.vue';
import UiButton from '@/components/ui/Button';
import UiSwitch from '@/components/ui/Switch';

withDefaults(
  defineProps<{
    checkingUpdate: boolean;
    recordingHotkey: boolean;
    hotkeyLabel: string;
    factoryResetHotkey: string | null;
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
  (e: 'beginHotkeyCapture'): void;
  (e: 'requestClearHotkey'): void;
  (e: 'factoryReset'): void;
  (e: 'openToolkit', value: boolean): void;
  (e: 'uninstall'): void;
}>();

const importFileInput = ref<HTMLInputElement | null>(null);
const { t } = useI18n();

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
</script>
