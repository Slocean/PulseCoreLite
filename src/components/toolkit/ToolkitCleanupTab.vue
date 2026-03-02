<template>
  <UiToast :open="profileToastVisible" :message="profileToastMessage" />

  <UiToolkitPanel :title="t('toolkit.cleanupTitle')" :collapsible="false">
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
  </UiToolkitPanel>

  <UiToolkitPanel :title="t('toolkit.profileTitle')" :collapsible="false">
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
            aria-label="Copy path"
            title="Copy path"
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
        停止
      </UiButton>
    </div>
    <div class="toolkit-profile-status-row">
      <span class="toolkit-profile-status">
        {{ profileStatusText }}
      </span>
    </div>
  </UiToolkitPanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';
import UiToolkitPanel from '@/components/ui/ToolkitPanel';
import UiToast from '@/components/ui/Toast';
import { useAppStore } from '../../stores/app';
import { api } from '../../services/tauri';

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

const profilePath = ref('');
const profileIntervalMs = ref(1000);
const profileDurationSec = ref(120);
const profileStatus = ref<{ active: boolean; path: string | null; startedAt: string | null; samples: number }>({
  active: false,
  path: null,
  startedAt: null,
  samples: 0
});
const profileToastMessage = ref('');
const profileToastVisible = ref(false);
let profileStatusTimer: number | undefined;
let profileToastTimer: number | undefined;

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

watch([memoryTrimEnabled, memoryTrimSystemEnabled, memoryTrimIntervalMinutes, memoryTrimTargets], () => {
  nextTick(() => emit('contentChange'));
});

const profileStatusText = computed(() => {
  if (!profileStatus.value.active) {
    return t('toolkit.profileStatusIdle');
  }
  const samples = profileStatus.value.samples;
  return t('toolkit.profileStatusRunning', { samples });
});

async function refreshProfileStatus() {
  try {
    profileStatus.value = await api.getProfileStatus();
  } catch {
    // ignore
  }
}

async function startProfile() {
  const durationSec = Number.isFinite(profileDurationSec.value) ? profileDurationSec.value : 120;
  const interval = Number.isFinite(profileIntervalMs.value) ? profileIntervalMs.value : 1000;
  const durationMs = Math.max(5, durationSec) * 1000;
  const response = await api.startProfileCapture({
    path: profilePath.value.trim() || 'profile-data',
    intervalMs: Math.max(200, interval),
    durationMs
  });
  profileStatus.value = response;
}

async function stopProfile() {
  const response = await api.stopProfileCapture();
  profileStatus.value = response;
}

async function loadProfileOutputDir() {
  try {
    profilePath.value = await api.getProfileOutputDir();
  } catch {
    profilePath.value = 'profile-data';
  }
}

async function copyProfilePath() {
  const text = profilePath.value.trim();
  if (!text) return;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(text);
    profileToastMessage.value = t('toolkit.copyPathSuccess');
    profileToastVisible.value = true;
    if (profileToastTimer != null) {
      window.clearTimeout(profileToastTimer);
    }
    profileToastTimer = window.setTimeout(() => {
      profileToastVisible.value = false;
    }, 2000);
  } catch {
    // ignore clipboard write failures
  }
}

async function openProfilePath() {
  const text = profilePath.value.trim();
  if (!text) return;
  try {
    await api.openProfileOutputPath(text);
  } catch {
    // ignore open failures
  }
}

onMounted(() => {
  loadProfileOutputDir();
  refreshProfileStatus();
  profileStatusTimer = window.setInterval(refreshProfileStatus, 1000);
});

onUnmounted(() => {
  if (profileStatusTimer) {
    window.clearInterval(profileStatusTimer);
  }
  if (profileToastTimer != null) {
    window.clearTimeout(profileToastTimer);
  }
});
</script>

