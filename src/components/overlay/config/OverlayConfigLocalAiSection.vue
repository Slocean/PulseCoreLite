<template>
  <div class="overlay-config-language">
    <div class="overlay-config-local-ai-copy">
      <span class="overlay-config-label">{{ t('overlay.localAiModelDir') }}</span>
      <strong class="overlay-config-local-ai-value">{{ selectedModelDir || t('overlay.localAiNotSelected') }}</strong>
    </div>
    <div class="overlay-lang-buttons">
      <UiButton
        native-type="button"
        preset="overlay-chip"
        :disabled="!isTauriRuntime"
        @click="chooseModelDir">
        {{ t('overlay.localAiChooseDir') }}
      </UiButton>
    </div>
  </div>

  <div class="overlay-config-language">
    <div class="overlay-config-local-ai-copy">
      <span class="overlay-config-label">{{ t('overlay.localAiLauncherDir') }}</span>
      <strong class="overlay-config-local-ai-value">{{ launcherDisplayValue }}</strong>
    </div>
    <div class="overlay-lang-buttons">
      <UiButton
        v-if="selectedLauncherDir"
        native-type="button"
        preset="overlay-chip-soft"
        :disabled="!isTauriRuntime"
        @click="resetLauncherDir">
        {{ hasBundledLauncher ? t('overlay.localAiUseBundled') : t('overlay.localAiClearLauncher') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-chip"
        :disabled="!isTauriRuntime"
        @click="chooseLauncherDir">
        {{ t('overlay.localAiChooseDir') }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import { storageKeys, storageRepository } from '@/services/storageRepository';
import { api, inTauri } from '@/services/tauri';
import type { LocalAiStatus } from '@/types';

const props = defineProps<{
  packageFlavor: 'unknown' | 'lite' | 'ai';
}>();

const { t } = useI18n();
const isTauriRuntime = inTauri();
const selectedModelDir = ref(storageRepository.getStringSync(storageKeys.localAiModelDir) ?? null);
const selectedLauncherDir = ref(storageRepository.getStringSync(storageKeys.localAiLauncherDir) ?? null);
const localAiStatus = ref<LocalAiStatus | null>(null);

const hasBundledLauncher = computed(() => {
  if (localAiStatus.value) {
    return !localAiStatus.value.launcherNeedsSelection;
  }
  return props.packageFlavor === 'ai';
});
const launcherDisplayValue = computed(() => {
  if (selectedLauncherDir.value?.trim()) {
    return selectedLauncherDir.value;
  }
  return hasBundledLauncher.value ? t('overlay.localAiLauncherBundled') : t('overlay.localAiNotSelected');
});

onMounted(() => {
  void refreshLocalAiStatus();
});

async function refreshLocalAiStatus() {
  if (!isTauriRuntime) return;
  try {
    localAiStatus.value = await api.getLocalAiStatus();
    if (!selectedLauncherDir.value && localAiStatus.value.selectedLauncherDir) {
      selectedLauncherDir.value = localAiStatus.value.selectedLauncherDir;
    }
  } catch {
    localAiStatus.value = null;
  }
}

function notifyLocalAiSettingsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('pulsecorelite:local-ai-settings-changed', {
      detail: {
        selectedModelDir: selectedModelDir.value,
        selectedLauncherDir: selectedLauncherDir.value
      }
    })
  );
}

async function chooseModelDir() {
  if (!isTauriRuntime) return;
  const selected = await open({
    directory: true,
    multiple: false
  });
  if (typeof selected !== 'string') return;
  selectedModelDir.value = selected;
  storageRepository.setStringSync(storageKeys.localAiModelDir, selected);
  void storageRepository.setString(storageKeys.localAiModelDir, selected);
  notifyLocalAiSettingsChanged();
  void refreshLocalAiStatus();
}

async function chooseLauncherDir() {
  if (!isTauriRuntime) return;
  const selected = await open({
    directory: true,
    multiple: false
  });
  if (typeof selected !== 'string') return;
  selectedLauncherDir.value = selected;
  storageRepository.setStringSync(storageKeys.localAiLauncherDir, selected);
  void storageRepository.setString(storageKeys.localAiLauncherDir, selected);
  notifyLocalAiSettingsChanged();
  void refreshLocalAiStatus();
}

function resetLauncherDir() {
  selectedLauncherDir.value = null;
  storageRepository.removeSync(storageKeys.localAiLauncherDir);
  void storageRepository.remove(storageKeys.localAiLauncherDir);
  notifyLocalAiSettingsChanged();
  void refreshLocalAiStatus();
}
</script>

<style scoped>
.overlay-config-local-ai-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.overlay-config-local-ai-value {
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.94);
  word-break: break-word;
}

.overlay-config-language {
  align-items: start;
}

.overlay-lang-buttons {
  align-self: center;
}
</style>
