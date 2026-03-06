import { defineStore } from 'pinia';

import { api, inTauri } from '../services/tauri';
import { storageKeys, storageRepository } from '../services/storageRepository';
import type { AppSettings } from '../types';
import {
  MEMORY_TRIM_MAX,
  MEMORY_TRIM_MIN,
  MEMORY_TRIM_TARGET_APP,
  MEMORY_TRIM_TARGET_SYSTEM,
  computeEffectiveSystemTrimEnabled,
  computeEffectiveTrimEnabled,
  defaultSettings,
  filterTargetsByEnabled,
  normalizeMemoryTrimTargets,
  persistSettings,
  resolveSettings,
  type MemoryTrimTarget
} from './modules/appStateDomain';

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

async function broadcastSettingsSync() {
  if (!inTauri()) {
    return;
  }
  try {
    const [{ getCurrentWindow }, { WebviewWindow }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/webviewWindow')
    ]);
    const win = getCurrentWindow();
    const labels = ['main', 'taskbar', 'toolkit'];
    const existingLabels = await Promise.all(
      labels.map(async label => {
        try {
          return (await WebviewWindow.getByLabel(label)) ? label : null;
        } catch {
          return null;
        }
      })
    );
    await Promise.allSettled(
      existingLabels
        .filter((label): label is string => label != null)
        .map(label => win.emitTo(label, 'pulsecorelite://settings-sync', null))
    );
  } catch {
    // ignore
  }
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: defaultSettings()
  }),
  actions: {
    hydrateSettings(nextSettings: AppSettings | null | undefined) {
      this.settings = resolveSettings(nextSettings ?? this.settings);
    },
    reloadFromStorage() {
      this.settings = resolveSettings(this.settings);
    },
    persistAndSync() {
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    setLanguage(language: AppSettings['language']) {
      if (this.settings.language === language) {
        return;
      }
      this.settings = {
        ...this.settings,
        language
      };
      this.persistAndSync();
    },
    setCloseToTray(closeToTray: boolean) {
      if (this.settings.closeToTray === closeToTray) {
        return;
      }
      this.settings = {
        ...this.settings,
        closeToTray
      };
      this.persistAndSync();
    },
    async setAutoStartEnabled(autoStartEnabled: boolean) {
      if (this.settings.autoStartEnabled === autoStartEnabled) {
        return;
      }
      const previous = this.settings.autoStartEnabled;
      this.settings = {
        ...this.settings,
        autoStartEnabled
      };
      this.persistAndSync();
      if (!inTauri()) {
        return;
      }
      try {
        await api.setAutoStartEnabled(autoStartEnabled);
        const confirmed = await api.getAutoStartEnabled();
        if (confirmed !== this.settings.autoStartEnabled) {
          this.settings = {
            ...this.settings,
            autoStartEnabled: confirmed
          };
          this.persistAndSync();
        }
      } catch {
        this.settings = {
          ...this.settings,
          autoStartEnabled: previous
        };
        this.persistAndSync();
      }
    },
    async setMemoryTrimEnabled(memoryTrimEnabled: boolean) {
      if (this.settings.memoryTrimEnabled === memoryTrimEnabled) {
        return;
      }
      const previous = this.settings.memoryTrimEnabled;
      const previousTargets = this.settings.memoryTrimTargets;
      const nextTargets = memoryTrimEnabled
        ? previousTargets
        : previousTargets.filter(target => target !== MEMORY_TRIM_TARGET_APP);
      this.settings = {
        ...this.settings,
        memoryTrimEnabled,
        memoryTrimTargets: nextTargets
      };
      this.persistAndSync();
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimEnabled(computeEffectiveTrimEnabled(this.settings));
      } catch {
        this.settings = {
          ...this.settings,
          memoryTrimEnabled: previous,
          memoryTrimTargets: previousTargets
        };
        this.persistAndSync();
      }
    },
    async setMemoryTrimSystemEnabled(memoryTrimSystemEnabled: boolean) {
      if (this.settings.memoryTrimSystemEnabled === memoryTrimSystemEnabled) {
        return;
      }
      const previous = this.settings.memoryTrimSystemEnabled;
      const previousTargets = this.settings.memoryTrimTargets;
      const nextTargets = memoryTrimSystemEnabled
        ? previousTargets
        : previousTargets.filter(target => target !== MEMORY_TRIM_TARGET_SYSTEM);
      this.settings = {
        ...this.settings,
        memoryTrimSystemEnabled,
        memoryTrimTargets: nextTargets
      };
      this.persistAndSync();
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimSystemEnabled(computeEffectiveSystemTrimEnabled(this.settings));
      } catch {
        this.settings = {
          ...this.settings,
          memoryTrimSystemEnabled: previous,
          memoryTrimTargets: previousTargets
        };
        this.persistAndSync();
      }
    },
    async setMemoryTrimTargets(memoryTrimTargets: MemoryTrimTarget[]) {
      const normalized = normalizeMemoryTrimTargets(memoryTrimTargets);
      const filtered = filterTargetsByEnabled(this.settings, normalized);
      const previous = this.settings.memoryTrimTargets;
      const same =
        filtered.length === previous.length && filtered.every(target => previous.includes(target));
      if (same) {
        return;
      }
      this.settings = {
        ...this.settings,
        memoryTrimTargets: filtered
      };
      this.persistAndSync();
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimEnabled(computeEffectiveTrimEnabled(this.settings));
        await api.setMemoryTrimSystemEnabled(computeEffectiveSystemTrimEnabled(this.settings));
      } catch {
        this.settings = {
          ...this.settings,
          memoryTrimTargets: previous
        };
        this.persistAndSync();
      }
    },
    async setMemoryTrimIntervalMinutes(intervalMinutes: number) {
      const next = Math.max(MEMORY_TRIM_MIN, Math.min(MEMORY_TRIM_MAX, Math.round(intervalMinutes)));
      if (this.settings.memoryTrimIntervalMinutes === next) {
        return;
      }
      const previous = this.settings.memoryTrimIntervalMinutes;
      this.settings = {
        ...this.settings,
        memoryTrimIntervalMinutes: next
      };
      this.persistAndSync();
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimIntervalMinutes(next);
      } catch {
        this.settings = {
          ...this.settings,
          memoryTrimIntervalMinutes: previous
        };
        this.persistAndSync();
      }
    },
    setRememberOverlayPosition(rememberOverlayPosition: boolean) {
      if (this.settings.rememberOverlayPosition === rememberOverlayPosition) {
        return;
      }
      this.settings = {
        ...this.settings,
        rememberOverlayPosition
      };
      if (!rememberOverlayPosition && typeof window !== 'undefined') {
        storageRepository.removeSync(storageKeys.overlayPosition);
      }
      this.persistAndSync();
    },
    setOverlayAlwaysOnTop(overlayAlwaysOnTop: boolean) {
      if (this.settings.overlayAlwaysOnTop === overlayAlwaysOnTop) {
        return;
      }
      this.settings = {
        ...this.settings,
        overlayAlwaysOnTop
      };
      this.persistAndSync();
    },
    setTaskbarAlwaysOnTop(taskbarAlwaysOnTop: boolean) {
      if (this.settings.taskbarAlwaysOnTop === taskbarAlwaysOnTop) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarAlwaysOnTop
      };
      this.persistAndSync();
    },
    setTaskbarAutoHideOnFullscreen(taskbarAutoHideOnFullscreen: boolean) {
      if (this.settings.taskbarAutoHideOnFullscreen === taskbarAutoHideOnFullscreen) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarAutoHideOnFullscreen
      };
      this.persistAndSync();
    },
    setTaskbarPositionLocked(taskbarPositionLocked: boolean) {
      if (this.settings.taskbarPositionLocked === taskbarPositionLocked) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarPositionLocked
      };
      this.persistAndSync();
    },
    async setTaskbarMonitorEnabled(taskbarMonitorEnabled: boolean) {
      if (this.settings.taskbarMonitorEnabled === taskbarMonitorEnabled) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarMonitorEnabled
      };
      this.persistAndSync();

      if (!inTauri()) {
        return;
      }

      const label = await getCurrentWindowLabel();
      if (label !== 'main') {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().emitTo('main', 'pulsecorelite://settings-sync', null);
        } catch {
          // best-effort; ignore
        }
      }
    },
    async setNativeTaskbarMonitorEnabled(nativeTaskbarMonitorEnabled: boolean) {
      if (this.settings.nativeTaskbarMonitorEnabled === nativeTaskbarMonitorEnabled) {
        return;
      }
      this.settings = {
        ...this.settings,
        nativeTaskbarMonitorEnabled
      };
      this.persistAndSync();

      if (!inTauri()) {
        return;
      }

      const label = await getCurrentWindowLabel();
      if (label !== 'main') {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().emitTo('main', 'pulsecorelite://settings-sync', null);
        } catch {
          // best-effort; ignore
        }
      }
    },
    setFactoryResetHotkey(factoryResetHotkey: string | null) {
      if (this.settings.factoryResetHotkey === factoryResetHotkey) {
        return;
      }
      this.settings = {
        ...this.settings,
        factoryResetHotkey
      };
      this.persistAndSync();
    },
    async syncAutoStartEnabled() {
      if (!inTauri()) {
        return;
      }
      try {
        const desired = this.settings.autoStartEnabled;
        const current = await api.getAutoStartEnabled();
        if (current !== desired) {
          try {
            await api.setAutoStartEnabled(desired);
          } catch {
            // ignore
          }
        }
        const confirmed = await api.getAutoStartEnabled();
        if (confirmed !== this.settings.autoStartEnabled) {
          this.settings = {
            ...this.settings,
            autoStartEnabled: confirmed
          };
          this.persistAndSync();
        }
      } catch {
        return;
      }
    },
    async syncMemoryTrimEnabled() {
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimEnabled(computeEffectiveTrimEnabled(this.settings));
      } catch {
        return;
      }
    },
    async syncMemoryTrimSystemEnabled() {
      if (!inTauri()) {
        return;
      }
      try {
        await api.setMemoryTrimSystemEnabled(computeEffectiveSystemTrimEnabled(this.settings));
      } catch {
        return;
      }
    },
    async syncMemoryTrimInterval() {
      if (!inTauri()) {
        return;
      }
      const value = Math.max(
        MEMORY_TRIM_MIN,
        Math.min(MEMORY_TRIM_MAX, Math.round(this.settings.memoryTrimIntervalMinutes))
      );
      try {
        await api.setMemoryTrimIntervalMinutes(value);
      } catch {
        return;
      }
    }
  }
});
