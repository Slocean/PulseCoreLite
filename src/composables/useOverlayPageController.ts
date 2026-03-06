import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

import { api, inTauri, listenEvent } from '../services/tauri';
import { useToastService } from './useToastService';
import type { ReminderScreenEventPayload } from '../types';
import type { useAppStore } from '../stores/app';

type UpdateInfo = {
  version?: string;
  notes?: string;
};

type UseOverlayPageControllerOptions = {
  store: ReturnType<typeof useAppStore>;
  t: (key: string, params?: Record<string, unknown>) => string;
  updateAvailable: Readonly<Ref<boolean>>;
  updateInfo: Readonly<Ref<UpdateInfo | null>>;
  checkingUpdate: Readonly<Ref<boolean>>;
  updateError: Readonly<Ref<string | null>>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  refreshToolkitState: () => Promise<void>;
  disposeToolkitWindow: () => void;
  onReminderTrigger: (payload: ReminderScreenEventPayload) => void;
};

export function useOverlayPageController({
  store,
  t,
  updateAvailable,
  updateInfo,
  checkingUpdate,
  updateError,
  checkForUpdates,
  installUpdate,
  refreshToolkitState,
  disposeToolkitWindow,
  onReminderTrigger
}: UseOverlayPageControllerOptions) {
  const showConfig = ref(false);
  const updateDialogOpen = ref(false);
  const { showToast } = useToastService('overlay');
  const releaseNotesUrl = 'https://github.com/Slocean/PulseCoreLite/releases';
  let unlistenReminderTrigger: (() => void) | null = null;

  const closeToTray = computed({
    get: () => store.settings.closeToTray,
    set: value => store.setCloseToTray(value)
  });
  const autoStartEnabled = computed({
    get: () => store.settings.autoStartEnabled,
    set: value => void store.setAutoStartEnabled(value)
  });
  const memoryTrimEnabled = computed({
    get: () => store.settings.memoryTrimEnabled,
    set: value => void store.setMemoryTrimEnabled(value)
  });
  const rememberOverlayPosition = computed({
    get: () => store.settings.rememberOverlayPosition,
    set: value => store.setRememberOverlayPosition(value)
  });
  const overlayAlwaysOnTop = computed({
    get: () => store.settings.overlayAlwaysOnTop,
    set: value => store.setOverlayAlwaysOnTop(value)
  });
  const taskbarMonitorEnabled = computed({
    get: () => store.settings.taskbarMonitorEnabled,
    set: value => void store.setTaskbarMonitorEnabled(value)
  });
  const nativeTaskbarMonitorEnabled = computed({
    get: () => store.settings.nativeTaskbarMonitorEnabled,
    set: value => void store.setNativeTaskbarMonitorEnabled(value)
  });
  const factoryResetHotkey = computed({
    get: () => store.settings.factoryResetHotkey,
    set: value => store.setFactoryResetHotkey(value)
  });

  const appUsageLabel = computed(() => {
    const snap = store.snapshot;
    const cpu = snap.appCpuUsagePct ?? 0;
    const mem = snap.appMemoryMb;
    const parts: string[] = [];
    parts.push(`${cpu.toFixed(1)}%`);
    if (mem != null) parts.push(`${mem.toFixed(0)}MB`);
    return parts.join(' · ');
  });

  const updateNotesFooterText = computed(() =>
    store.settings.language === 'zh-CN' ? `完整更新公告：${releaseNotesUrl}` : `Full release notes: ${releaseNotesUrl}`
  );
  const updateNotes = computed(() => {
    const raw = updateInfo.value?.notes?.trim() ?? '';
    if (!raw) return '';
    return filterUpdateNotesByLanguage(raw, store.settings.language);
  });

  function filterUpdateNotesByLanguage(notes: string, language: string): string {
    const lines = notes.split(/\r?\n/);
    const releaseLinePattern = /github\.com\/Slocean\/PulseCoreLite\/releases/i;
    const skipInlineLinkLine = (line: string) => releaseLinePattern.test(line);
    const hasCjk = (line: string) => /[\u4E00-\u9FFF]/.test(line);
    const hasLatin = (line: string) => /[A-Za-z]/.test(line);
    const hasDigit = (line: string) => /\d/.test(line);
    const kept = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (skipInlineLinkLine(trimmed)) return false;
      const cjk = hasCjk(trimmed);
      if (language === 'zh-CN') {
        return cjk || hasDigit(trimmed);
      }
      return !cjk && (hasLatin(trimmed) || hasDigit(trimmed));
    });

    const collapsed: string[] = [];
    for (const line of kept) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (collapsed.length > 0 && collapsed[collapsed.length - 1] !== '') {
          collapsed.push('');
        }
        continue;
      }
      collapsed.push(line);
    }

    const filtered = collapsed.join('\n').trim();
    return filtered || notes;
  }

  function openUpdateDialog() {
    updateDialogOpen.value = true;
  }

  function showUpdateToast(message: string) {
    showToast(message);
  }

  async function triggerUpdateCheck() {
    if (checkingUpdate.value) {
      return;
    }
    await checkForUpdates();
    if (updateAvailable.value) {
      openUpdateDialog();
      return;
    }
    if (updateError.value) {
      showUpdateToast(t('overlay.updateCheckFailed', { message: updateError.value }));
      return;
    }
    showUpdateToast(t('overlay.updateUpToDate'));
  }

  async function handleVersionClick() {
    if (updateAvailable.value) {
      openUpdateDialog();
      return;
    }
    await triggerUpdateCheck();
  }

  async function handleCheckUpdate() {
    if (updateAvailable.value) {
      openUpdateDialog();
      return;
    }
    await triggerUpdateCheck();
  }

  function closeUpdateDialog() {
    updateDialogOpen.value = false;
  }

  async function handleInstallUpdate() {
    await installUpdate();
  }

  function handleClose() {
    void store.exitApp();
  }

  function minimizeOverlay() {
    void store.minimizeOverlay();
  }

  function setLanguage(language: 'zh-CN' | 'en-US') {
    store.setLanguage(language);
  }

  async function applyOverlayTopmost(enabled: boolean) {
    if (!inTauri()) {
      return;
    }
    try {
      await api.setWindowSystemTopmost('main', enabled);
    } catch {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(enabled);
      } catch {
        // ignore
      }
    }
  }

  async function setupReminderTriggerListener() {
    if (!inTauri()) return;
    if (unlistenReminderTrigger) return;
    unlistenReminderTrigger = await listenEvent<ReminderScreenEventPayload>('reminder://trigger', payload => {
      onReminderTrigger(payload);
    });
  }

  watch(
    overlayAlwaysOnTop,
    enabled => {
      if (!inTauri()) return;
      void applyOverlayTopmost(enabled);
    },
    { immediate: true }
  );

  watch(
    showConfig,
    value => {
      if (!value) return;
      void refreshToolkitState();
    },
    { immediate: true }
  );

  onMounted(() => {
    void refreshToolkitState();
    void checkForUpdates();
    void setupReminderTriggerListener();
  });

  onBeforeUnmount(() => {
    if (unlistenReminderTrigger) {
      unlistenReminderTrigger();
      unlistenReminderTrigger = null;
    }
    disposeToolkitWindow();
  });

  return {
    showConfig,
    closeToTray,
    autoStartEnabled,
    memoryTrimEnabled,
    rememberOverlayPosition,
    overlayAlwaysOnTop,
    taskbarMonitorEnabled,
    nativeTaskbarMonitorEnabled,
    factoryResetHotkey,
    appUsageLabel,
    updateDialogOpen,
    updateNotesFooterText,
    updateNotes,
    handleVersionClick,
    handleCheckUpdate,
    closeUpdateDialog,
    handleInstallUpdate,
    handleClose,
    minimizeOverlay,
    setLanguage
  };
}
