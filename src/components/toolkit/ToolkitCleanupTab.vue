<template>
  <div class="toolkit-card">
    <h2 class="toolkit-section-title">{{ t('toolkit.cleanupTitle') }}</h2>
    <div class="toolkit-cleanup-list">
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupEnable') }}</span>
        <label class="overlay-switch" :aria-label="t('toolkit.cleanupEnable')">
          <input v-model="memoryTrimEnabled" type="checkbox" role="switch" />
          <span class="overlay-switch-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupSystem') }}</span>
        <label class="overlay-switch" :aria-label="t('toolkit.cleanupSystem')">
          <input v-model="memoryTrimSystemEnabled" type="checkbox" role="switch" />
          <span class="overlay-switch-track" aria-hidden="true"></span>
        </label>
      </div>
    </div>
    <div class="overlay-config-range">
      <UiButton native-type="button" class="toolkit-link-label" variant="text" @click="openTargetsDialog">
        {{ t('toolkit.cleanupInterval') }}
      </UiButton>
      <span class="overlay-config-value">{{ memoryTrimIntervalMinutes }}{{ t('toolkit.minutes') }}</span>
      <input
        type="range"
        min="1"
        max="30"
        step="1"
        v-model.number="memoryTrimIntervalMinutes" />
    </div>
  </div>

  <div class="toolkit-card">
    <h2 class="toolkit-section-title">{{ t('toolkit.profileTitle') }}</h2>
    <p class="toolkit-profile-hint">{{ t('toolkit.profileHint') }}</p>
    <div class="toolkit-profile-grid">
      <div class="toolkit-profile-row">
        <label class="overlay-config-label" :for="profilePathId">{{ t('toolkit.profilePath') }}</label>
        <input
          :id="profilePathId"
          v-model="profilePath"
          type="text"
          class="toolkit-profile-input"
          autocomplete="off" />
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
        class="overlay-config-primary"
        variant="text"
        :disabled="profileStatus.active"
        @click="startProfile">
        {{ t('toolkit.profileStart') }}
      </UiButton>
      <UiButton
        native-type="button"
        class="overlay-config-danger"
        variant="text"
        :disabled="!profileStatus.active"
        @click="stopProfile">
        {{ t('toolkit.profileStop') }}
      </UiButton>
      <span class="toolkit-profile-status">
        {{ profileStatusText }}
      </span>
    </div>
  </div>

  <OverlayDialog
    v-model:open="targetsDialogOpen"
    :title="t('toolkit.cleanupTargetsTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="confirmTargets"
    @cancel="cancelTargets">
    <template #body>
      <div v-if="enabledTargetOptions.length" class="overlay-config overlay-config--single-column">
        <label v-for="item in enabledTargetOptions" :key="item.id">
          <input v-model="tempTargets" type="checkbox" :value="item.id" />
          {{ item.label }}
        </label>
      </div>
      <div v-else class="overlay-dialog-message overlay-dialog-message--muted">
        {{ t('toolkit.cleanupTargetsEmpty') }}
      </div>
    </template>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import OverlayDialog from '../OverlayDialog.vue';
import { useAppStore } from '../../stores/app';
import { api } from '../../services/tauri';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const targetsDialogOpen = ref(false);
const tempTargets = ref<Array<'app' | 'system'>>([]);

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

const profilePath = ref(defaultProfilePath());
const profileIntervalMs = ref(1000);
const profileDurationSec = ref(120);
const profileStatus = ref<{ active: boolean; path: string | null; startedAt: string | null; samples: number }>({
  active: false,
  path: null,
  startedAt: null,
  samples: 0
});
let profileStatusTimer: number | undefined;

const enabledTargetOptions = computed(() => {
  const options: Array<{ id: 'app' | 'system'; label: string }> = [];
  if (memoryTrimEnabled.value) {
    options.push({ id: 'app', label: t('toolkit.cleanupEnable') });
  }
  if (memoryTrimSystemEnabled.value) {
    options.push({ id: 'system', label: t('toolkit.cleanupSystem') });
  }
  return options;
});

watch([memoryTrimEnabled, memoryTrimSystemEnabled, memoryTrimIntervalMinutes, memoryTrimTargets], () => {
  nextTick(() => emit('contentChange'));
});

watch(
  () => targetsDialogOpen.value,
  open => {
    if (!open) return;
    const enabledIds = enabledTargetOptions.value.map(item => item.id);
    tempTargets.value = memoryTrimTargets.value.filter(target => enabledIds.includes(target));
  }
);

function openTargetsDialog() {
  targetsDialogOpen.value = true;
}

async function confirmTargets() {
  await store.setMemoryTrimTargets(tempTargets.value);
}

function cancelTargets() {
  // no-op, temp selections are discarded
}

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
    path: profilePath.value,
    intervalMs: Math.max(200, interval),
    durationMs
  });
  profileStatus.value = response;
}

async function stopProfile() {
  const response = await api.stopProfileCapture();
  profileStatus.value = response;
}

function defaultProfilePath() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(
    now.getSeconds()
  ).padStart(2, '0')}`;
  return `profile-data/taskbar-profile-${stamp}.jsonl`;
}

onMounted(() => {
  refreshProfileStatus();
  profileStatusTimer = window.setInterval(refreshProfileStatus, 1000);
});

onUnmounted(() => {
  if (profileStatusTimer) {
    window.clearInterval(profileStatusTimer);
  }
});
</script>

