<template>
  <UiToast :open="profileToastVisible" :message="profileToastMessage" />

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.cleanupTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div class="toolkit-cleanup-list">
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupEnable') }}</span>
        <UiSwitch v-model="memoryTrimEnabled" :aria-label="t('toolkit.cleanupEnable')" />
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupSystem') }}</span>
        <UiSwitch v-model="memoryTrimSystemEnabled" :aria-label="t('toolkit.cleanupSystem')" />
      </div>
    </div>
    <div class="overlay-config-range">
      <span class="overlay-config-label">{{ t('toolkit.cleanupInterval') }}</span>
      <span class="overlay-config-value">{{ memoryTrimIntervalMinutes }}{{ t('toolkit.minutes') }}</span>
      <input
        type="range"
        min="1"
        max="30"
        step="1"
        v-model.number="memoryTrimIntervalMinutes" />
    </div>
    <div class="overlay-config-row">
      <span class="overlay-config-label">{{ t('toolkit.cleanupTargetsTitle') }}</span>
      <UiSelect
        v-model="cleanupTargetsModel"
        :width="200"
        :options="enabledTargetOptions"
        :placeholder="t('toolkit.cleanupTargetsTitle')"
        :empty-text="t('toolkit.cleanupTargetsEmpty')"
        multiple />
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.profileTitle')" :collapsible="false" title-class="toolkit-section-title">
    <p class="toolkit-profile-hint">{{ t('toolkit.profileHint') }}</p>
    <div class="toolkit-profile-grid">
      <div class="toolkit-profile-row">
        <label class="overlay-config-label" :for="profilePathId">{{ t('toolkit.profilePath') }}</label>
        <div class="toolkit-profile-path-control">
          <input
            :id="profilePathId"
            v-model="profilePath"
            type="text"
            class="toolkit-profile-input"
            autocomplete="off" />
          <UiButton
            native-type="button"
            preset="overlay-action-primary"
            :aria-label="t('toolkit.copyPath')"
            :title="t('toolkit.copyPath')"
            @click="copyProfilePath">
            <span class="material-symbols-outlined">content_copy</span>
          </UiButton>
          <UiButton
            native-type="button"
            preset="overlay-action-primary"
            :aria-label="t('toolkit.openPath')"
            :title="t('toolkit.openPath')"
            @click="openProfilePath">
            <span class="material-symbols-outlined">folder_open</span>
          </UiButton>
        </div>
      </div>
      <div class="toolkit-profile-row">
        <label class="overlay-config-label" :for="profileIntervalId">{{ t('toolkit.profileInterval') }}</label>
        <input
          :id="profileIntervalId"
          v-model.number="profileIntervalMs"
          type="number"
          min="200"
          max="10000"
          class="toolkit-profile-input"
          autocomplete="off" />
      </div>
      <div class="toolkit-profile-row">
        <label class="overlay-config-label" :for="profileDurationId">{{ t('toolkit.profileDuration') }}</label>
        <input
          :id="profileDurationId"
          v-model.number="profileDurationSec"
          type="number"
          min="5"
          max="1800"
          class="toolkit-profile-input"
          autocomplete="off" />
      </div>
    </div>
    <div class="toolkit-profile-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="profileStatus.active"
        @click="startProfile">
        {{ t('toolkit.profileStart') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-danger"
        :disabled="!profileStatus.active"
        @click="stopProfile">
        {{ t('toolkit.profileStop') }}
      </UiButton>
    </div>
    <div class="toolkit-profile-status-row">
      <span class="toolkit-profile-status">
        {{ profileStatusText }}
      </span>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';
import UiToast from '@/components/ui/Toast';
import { useToolkitProfileCapture } from '../../composables/useToolkitProfileCapture';
import { useAppStore } from '../../stores/app';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const memoryTrimEnabled = computed({
  get: () => store.settings.memoryTrimEnabled,
  set: value => void store.setMemoryTrimEnabled(value)
});
const memoryTrimSystemEnabled = computed({
  get: () => store.settings.memoryTrimSystemEnabled,
  set: value => void store.setMemoryTrimSystemEnabled(value)
});
const memoryTrimTargets = computed(() => store.settings.memoryTrimTargets);
const memoryTrimIntervalMinutes = computed({
  get: () => store.settings.memoryTrimIntervalMinutes,
  set: value => void store.setMemoryTrimIntervalMinutes(value)
});

const profilePathId = 'toolkit-profile-path';
const profileIntervalId = 'toolkit-profile-interval';
const profileDurationId = 'toolkit-profile-duration';

const enabledTargetOptions = computed(() => {
  const options: Array<{ value: 'app' | 'system'; label: string }> = [];
  if (memoryTrimEnabled.value) {
    options.push({ value: 'app', label: t('toolkit.cleanupEnable') });
  }
  if (memoryTrimSystemEnabled.value) {
    options.push({ value: 'system', label: t('toolkit.cleanupSystem') });
  }
  return options;
});

const cleanupTargetsModel = computed<Array<'app' | 'system'>>({
  get: () => {
    const enabledIds = new Set(enabledTargetOptions.value.map(item => item.value));
    return memoryTrimTargets.value.filter(target => enabledIds.has(target));
  },
  set: value => {
    const enabledIds = new Set(enabledTargetOptions.value.map(item => item.value));
    const next = value.filter(target => enabledIds.has(target));
    void store.setMemoryTrimTargets(next);
  }
});

const {
  profilePath,
  profileIntervalMs,
  profileDurationSec,
  profileStatus,
  profileStatusText,
  profileToastMessage,
  profileToastVisible,
  startProfile,
  stopProfile,
  copyProfilePath,
  openProfilePath
} = useToolkitProfileCapture({
  t: (key, params) => (params ? t(key, params) : t(key))
});

watch(
  [
    memoryTrimEnabled,
    memoryTrimSystemEnabled,
    memoryTrimIntervalMinutes,
    memoryTrimTargets,
    profileStatus,
    profileToastVisible
  ],
  () => {
    nextTick(() => emit('contentChange'));
  },
  { deep: true }
);
</script>
