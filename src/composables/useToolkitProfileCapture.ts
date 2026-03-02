import { computed, onMounted, onUnmounted, ref } from 'vue';

import { api } from '../services/tauri';
import type { ProfileStatus } from '../types';

type Translate = (key: string, params?: Record<string, unknown>) => string;

type UseToolkitProfileCaptureOptions = {
  t: Translate;
};

export function useToolkitProfileCapture(options: UseToolkitProfileCaptureOptions) {
  const { t } = options;
  const profilePath = ref('');
  const profileIntervalMs = ref(1000);
  const profileDurationSec = ref(120);
  const profileStatus = ref<ProfileStatus>({
    active: false,
    path: null,
    startedAt: null,
    samples: 0
  });
  const profileToastMessage = ref('');
  const profileToastVisible = ref(false);
  let profileStatusTimer: number | undefined;
  let profileToastTimer: number | undefined;

  const profileStatusText = computed(() => {
    if (!profileStatus.value.active) {
      return t('toolkit.profileStatusIdle');
    }
    return t('toolkit.profileStatusRunning', { samples: profileStatus.value.samples });
  });

  onMounted(() => {
    void loadProfileOutputDir();
    void refreshProfileStatus();
    profileStatusTimer = window.setInterval(() => {
      void refreshProfileStatus();
    }, 1000);
  });

  onUnmounted(() => {
    if (profileStatusTimer) {
      window.clearInterval(profileStatusTimer);
    }
    if (profileToastTimer != null) {
      window.clearTimeout(profileToastTimer);
    }
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
    profileStatus.value = await api.startProfileCapture({
      path: profilePath.value.trim() || 'profile-data',
      intervalMs: Math.max(200, interval),
      durationMs
    });
  }

  async function stopProfile() {
    profileStatus.value = await api.stopProfileCapture();
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

  return {
    profilePath,
    profileIntervalMs,
    profileDurationSec,
    profileStatus,
    profileStatusText,
    profileToastMessage,
    profileToastVisible,
    refreshProfileStatus,
    startProfile,
    stopProfile,
    copyProfilePath,
    openProfilePath
  };
}
