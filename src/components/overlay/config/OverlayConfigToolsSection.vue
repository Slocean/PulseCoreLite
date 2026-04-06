<template>
  <div class="overlay-config-duo overlay-config-duo--tools">
    <div v-if="canSwitchPackageFlavor" class="overlay-config-package">
      <div class="overlay-config-package-header">
        <div class="overlay-config-package-actions">
          <div class="overlay-config-label">{{ t('overlay.packageFlavor') }}</div>
          <div class="overlay-config-package-badge">
            {{ packageFlavorLabel }}
          </div>
          <div class="overlay-lang-buttons">
            <UiButton
              native-type="button"
              preset="overlay-chip"
              :disabled="switchingPackageFlavor"
              @click="emit('switchPackageFlavor')">
              {{
                switchingPackageFlavor
                  ? t('overlay.switchingPackageFlavor')
                  : packageFlavor === 'ai'
                    ? t('overlay.switchToLite')
                    : t('overlay.switchToAi')
              }}
            </UiButton>
          </div>
        </div>
      </div>
      <!-- <div class="overlay-config-package-hint">
        {{ t('overlay.packageFlavorCurrent', { flavor: packageFlavorLabel }) }}
      </div> -->
    </div>

    <div class="overlay-config-language">
      <span class="overlay-config-label">{{ t('overlay.update') }}</span>
      <div class="overlay-lang-buttons">
        <UiButton
          native-type="button"
          preset="overlay-chip"
          :disabled="checkingUpdate"
          @click="emit('checkUpdate')">
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
      <UiSwitch
        :model-value="toolkitSwitchOn"
        :aria-label="t('overlay.toolkit')"
        @update:model-value="handleToolkitToggle" />
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

const props = withDefaults(
  defineProps<{
    checkingUpdate: boolean;
    toolkitSwitchOn: boolean;
    canUninstall: boolean;
    canSwitchPackageFlavor: boolean;
    packageFlavor: 'unknown' | 'lite' | 'ai';
    switchingPackageFlavor: boolean;
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
  (e: 'switchPackageFlavor'): void;
  (e: 'uninstall'): void;
}>();

const factoryResetHotkey = defineModel<string | null>('factoryResetHotkey', { required: true });

const importFileInput = ref<HTMLInputElement | null>(null);
const { t } = useI18n();
const recordingHotkey = ref(false);
let hotkeyUnlisten: (() => void) | null = null;
const hotkeyClearDialogOpen = ref(false);

const hotkeyLabel = computed(() => factoryResetHotkey.value ?? t('overlay.hotkeyNotSet'));
const FORCE_SHOW_PACKAGE_FLAVOR_PANEL = true;
const showPackageFlavorPanel = FORCE_SHOW_PACKAGE_FLAVOR_PANEL || props.canSwitchPackageFlavor;
const packageFlavorLabel = computed(() => {
  if (props.packageFlavor === 'ai') {
    return t('overlay.packageFlavorAi');
  }
  if (props.packageFlavor === 'lite') {
    return t('overlay.packageFlavorLite');
  }
  return t('common.na');
});

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

<style scoped>
.overlay-config-duo--tools {
  align-items: start;
}

.overlay-config-package {
  grid-column: 1 / -1;
  display: flex;
  /* gap: 8px; */
  /* padding: 10px 12px; */
  /* border-radius: 10px; */
  /* border: 1px solid rgba(255, 255, 255, 0.12); */
  /* background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.18)); */
}

.overlay-config-package-header {
  /* display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px; */
}

.overlay-config-package-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.overlay-config-package-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.overlay-config-package-hint {
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
}

@media (max-width: 560px) {
  .overlay-config-package-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .overlay-config-package-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .overlay-config-package-badge {
    white-space: normal;
  }
}
</style>
