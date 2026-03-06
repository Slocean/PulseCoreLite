import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { api, inTauri, listenEvent } from '../services/tauri';
import { storageKeys, storageRepository } from '../services/storageRepository';
import type { AppBootstrap, TelemetrySnapshot } from '../types';
import { defaultSettings, emptyHardware, emptySnapshot } from './modules/appStateDomain';
import { useSettingsStore } from './settingsStore';
import { useSystemStore } from './systemStore';
import { useTelemetryStore } from './telemetryStore';
import { useWindowStore } from './windowStore';
import { emitSyncEvent } from '../services/syncBus';

type NativeTaskbarSyncPayload = {
  settings?: Partial<{
    taskbarAlwaysOnTop: boolean;
    taskbarAutoHideOnFullscreen: boolean;
    rememberOverlayPosition: boolean;
    taskbarPositionLocked: boolean;
    nativeTaskbarMonitorEnabled: boolean;
  }>;
  prefs?: Partial<{
    showCpu: boolean;
    showCpuFreq: boolean;
    showCpuTemp: boolean;
    showGpu: boolean;
    showGpuTemp: boolean;
    showMemory: boolean;
    showApp: boolean;
    showDown: boolean;
    showUp: boolean;
    showLatency: boolean;
    twoLineMode: boolean;
    backgroundMode: 'transparent' | 'dark' | 'light';
  }>;
};

async function getCurrentWindowLabel(): Promise<string | null> {
  if (!inTauri()) {
    return null;
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

export const useAppStore = defineStore('app', () => {
  const settingsStore = useSettingsStore();
  const telemetryStore = useTelemetryStore();
  const windowStore = useWindowStore();
  const systemStore = useSystemStore();

  const ready = ref(false);
  const bootstrapped = ref(false);
  const unlisteners = ref<Array<() => void>>([]);

  const settings = computed(() => settingsStore.settings);
  const snapshot = computed(() => telemetryStore.snapshot);
  const hardwareInfo = computed(() => telemetryStore.hardwareInfo);
  const installationMode = computed(() => systemStore.installationMode);
  const trayReady = computed(() => windowStore.trayReady);

  function pushSnapshot(nextSnapshot: TelemetrySnapshot) {
    telemetryStore.pushSnapshot(nextSnapshot);
  }

  function applyBootstrap(payload: AppBootstrap) {
    settingsStore.hydrateSettings(payload.settings);
    telemetryStore.applyBootstrap(payload);
  }

  async function bindEvents() {
    unlisteners.value.push(
      await listenEvent<TelemetrySnapshot>('telemetry://snapshot', payload => pushSnapshot(payload))
    );
    unlisteners.value.push(
      await listenEvent<null>('pulsecorelite://settings-sync', () => {
        settingsStore.reloadFromStorage();
      })
    );
    unlisteners.value.push(
      await listenEvent<null>('pulsecorelite://ensure-tray', () => {
        void ensureTray();
      })
    );
    unlisteners.value.push(
      await listenEvent<null>('pulsecorelite://taskbar-prefs-sync', () => {
        void syncNativeTaskbarMonitor();
      })
    );
    unlisteners.value.push(
      await listenEvent<NativeTaskbarSyncPayload>('pulsecorelite://native-taskbar-sync', payload => {
        const nextSettings = payload?.settings;
        if (nextSettings && Object.keys(nextSettings).length > 0) {
          settingsStore.hydrateSettings({
            ...settingsStore.settings,
            ...nextSettings
          });
          settingsStore.persistAndSync();
        }

        const nextPrefs = payload?.prefs;
        if (nextPrefs && Object.keys(nextPrefs).length > 0) {
          const currentPrefs =
            storageRepository.getJsonSync<Record<string, unknown>>(storageKeys.taskbarPrefs) ?? {};
          const mergedPrefs = { ...currentPrefs, ...nextPrefs };
          storageRepository.setJsonSync(storageKeys.taskbarPrefs, mergedPrefs);
          void storageRepository.setJson(storageKeys.taskbarPrefs, mergedPrefs);
          void emitSyncEvent<null>('pulsecorelite://taskbar-prefs-sync', null, {
            labels: ['main', 'taskbar', 'toolkit']
          });
          void syncNativeTaskbarMonitor();
        }
      })
    );
  }

  async function bootstrap() {
    if (bootstrapped.value) {
      return;
    }

    if (inTauri()) {
      const bootstrapPayload = await api.getInitialState();
      applyBootstrap(bootstrapPayload);
      const label = await getCurrentWindowLabel();
      if (label === 'main') {
        void ensureTray();
        void ensureTaskbarMonitor();
        void syncNativeTaskbarMonitor();
        void syncAutoStartEnabled();
        void syncMemoryTrimEnabled();
        void syncMemoryTrimSystemEnabled();
        void syncMemoryTrimInterval();
        void systemStore.detectInstallationMode();
        unlisteners.value.push(
          watch(
            () => settingsStore.settings.taskbarMonitorEnabled,
            () => {
              void ensureTaskbarMonitor();
            }
          )
        );
        unlisteners.value.push(
          watch(
            () => [
              settingsStore.settings.nativeTaskbarMonitorEnabled,
              settingsStore.settings.taskbarAlwaysOnTop,
              settingsStore.settings.taskbarAutoHideOnFullscreen,
              settingsStore.settings.language
            ],
            () => {
              void syncNativeTaskbarMonitor();
            },
            { immediate: true }
          )
        );
      }
      await bindEvents();
      void refreshHardwareInfo();
    } else {
      applyBootstrap({
        latest_snapshot: emptySnapshot(),
        hardware_info: emptyHardware(),
        settings: defaultSettings()
      });
      systemStore.setPortableMode();
    }

    bootstrapped.value = true;
    ready.value = true;
  }

  async function refreshHardwareInfo() {
    await telemetryStore.refreshHardwareInfo();
  }

  async function toggleOverlay(visible: boolean) {
    await windowStore.toggleOverlay(visible);
  }

  async function ensureMainWindow() {
    await windowStore.ensureMainWindow(settingsStore.settings);
  }

  async function closeMainWindow() {
    await windowStore.closeMainWindow();
  }

  async function setRefreshRate(rateMs: number) {
    if (!inTauri()) {
      return;
    }
    await api.setRefreshRate(rateMs);
  }

  function setLanguage(language: 'zh-CN' | 'en-US') {
    settingsStore.setLanguage(language);
  }

  function setCloseToTray(closeToTray: boolean) {
    settingsStore.setCloseToTray(closeToTray);
  }

  async function setAutoStartEnabled(autoStartEnabled: boolean) {
    await settingsStore.setAutoStartEnabled(autoStartEnabled);
  }

  async function setMemoryTrimEnabled(memoryTrimEnabled: boolean) {
    await settingsStore.setMemoryTrimEnabled(memoryTrimEnabled);
  }

  async function setMemoryTrimSystemEnabled(memoryTrimSystemEnabled: boolean) {
    await settingsStore.setMemoryTrimSystemEnabled(memoryTrimSystemEnabled);
  }

  async function setMemoryTrimTargets(memoryTrimTargets: Array<'app' | 'system'>) {
    await settingsStore.setMemoryTrimTargets(memoryTrimTargets);
  }

  async function setMemoryTrimIntervalMinutes(intervalMinutes: number) {
    await settingsStore.setMemoryTrimIntervalMinutes(intervalMinutes);
  }

  function setRememberOverlayPosition(rememberOverlayPosition: boolean) {
    settingsStore.setRememberOverlayPosition(rememberOverlayPosition);
  }

  function setOverlayAlwaysOnTop(overlayAlwaysOnTop: boolean) {
    settingsStore.setOverlayAlwaysOnTop(overlayAlwaysOnTop);
  }

  function setTaskbarAlwaysOnTop(taskbarAlwaysOnTop: boolean) {
    settingsStore.setTaskbarAlwaysOnTop(taskbarAlwaysOnTop);
  }

  function setTaskbarAutoHideOnFullscreen(taskbarAutoHideOnFullscreen: boolean) {
    settingsStore.setTaskbarAutoHideOnFullscreen(taskbarAutoHideOnFullscreen);
  }

  function setTaskbarPositionLocked(taskbarPositionLocked: boolean) {
    settingsStore.setTaskbarPositionLocked(taskbarPositionLocked);
  }

  async function setTaskbarMonitorEnabled(taskbarMonitorEnabled: boolean) {
    await settingsStore.setTaskbarMonitorEnabled(taskbarMonitorEnabled);
  }

  async function setNativeTaskbarMonitorEnabled(nativeTaskbarMonitorEnabled: boolean) {
    await settingsStore.setNativeTaskbarMonitorEnabled(nativeTaskbarMonitorEnabled);
  }

  function setFactoryResetHotkey(factoryResetHotkey: string | null) {
    settingsStore.setFactoryResetHotkey(factoryResetHotkey);
  }

  async function syncAutoStartEnabled() {
    await settingsStore.syncAutoStartEnabled();
  }

  async function syncMemoryTrimEnabled() {
    await settingsStore.syncMemoryTrimEnabled();
  }

  async function syncMemoryTrimSystemEnabled() {
    await settingsStore.syncMemoryTrimSystemEnabled();
  }

  async function syncMemoryTrimInterval() {
    await settingsStore.syncMemoryTrimInterval();
  }

  async function factoryReset() {
    await systemStore.factoryReset();
  }

  async function ensureTray(): Promise<boolean> {
    return windowStore.ensureTray(settingsStore.settings);
  }

  async function handoffTrayToOtherWindow(): Promise<boolean> {
    return windowStore.handoffTrayToOtherWindow();
  }

  async function minimizeToTray() {
    await windowStore.minimizeToTray(settingsStore.settings);
  }

  async function minimizeOverlay() {
    await windowStore.minimizeOverlay();
  }

  async function ensureTaskbarFullscreenMonitor() {
    await windowStore.ensureTaskbarFullscreenMonitor(() => settingsStore.settings);
  }

  function startTaskbarFullscreenMonitor() {
    windowStore.startTaskbarFullscreenMonitor(() => settingsStore.settings);
  }

  function stopTaskbarFullscreenMonitor(restoreIfHidden = false) {
    windowStore.stopTaskbarFullscreenMonitor(restoreIfHidden, settingsStore.settings);
  }

  async function ensureTaskbarMonitor() {
    await windowStore.ensureTaskbarMonitor(settingsStore.settings);
  }

  async function syncNativeTaskbarMonitor() {
    await windowStore.syncNativeTaskbarMonitor(settingsStore.settings);
  }

  async function openTaskbarMonitor() {
    await windowStore.openTaskbarMonitor(settingsStore.settings);
  }

  async function closeTaskbarMonitor() {
    await windowStore.closeTaskbarMonitor();
  }

  async function closeToolkitWindow() {
    await windowStore.closeToolkitWindow();
  }

  async function exitApp() {
    await systemStore.exitApp();
  }

  async function uninstallApp(title: string, message: string) {
    await systemStore.uninstallApp(title, message);
  }

  function dispose() {
    stopTaskbarFullscreenMonitor();
    unlisteners.value.forEach(fn => fn());
    unlisteners.value = [];
  }

  return {
    ready,
    bootstrapped,
    snapshot,
    hardwareInfo,
    settings,
    installationMode,
    trayReady,
    pushSnapshot,
    applyBootstrap,
    bootstrap,
    refreshHardwareInfo,
    bindEvents,
    toggleOverlay,
    ensureMainWindow,
    closeMainWindow,
    setRefreshRate,
    setLanguage,
    setCloseToTray,
    setAutoStartEnabled,
    setMemoryTrimEnabled,
    setMemoryTrimSystemEnabled,
    setMemoryTrimTargets,
    setMemoryTrimIntervalMinutes,
    setRememberOverlayPosition,
    setOverlayAlwaysOnTop,
    setTaskbarAlwaysOnTop,
    setTaskbarAutoHideOnFullscreen,
    setTaskbarPositionLocked,
    setTaskbarMonitorEnabled,
    setNativeTaskbarMonitorEnabled,
    setFactoryResetHotkey,
    syncAutoStartEnabled,
    syncMemoryTrimEnabled,
    syncMemoryTrimSystemEnabled,
    syncMemoryTrimInterval,
    factoryReset,
    ensureTray,
    handoffTrayToOtherWindow,
    minimizeToTray,
    minimizeOverlay,
    ensureTaskbarFullscreenMonitor,
    startTaskbarFullscreenMonitor,
    stopTaskbarFullscreenMonitor,
    ensureTaskbarMonitor,
    syncNativeTaskbarMonitor,
    openTaskbarMonitor,
    closeTaskbarMonitor,
    closeToolkitWindow,
    exitApp,
    uninstallApp,
    dispose
  };
});
