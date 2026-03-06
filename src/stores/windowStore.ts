import { defineStore } from 'pinia';

import { api, inTauri } from '../services/tauri';
import { storageKeys, storageRepository } from '../services/storageRepository';
import type { AppSettings } from '../types';

const FULLSCREEN_POLL_MS = 800;
const TRAY_TEXT = {
  'zh-CN': {
    show: '显示主窗口',
    quit: '退出'
  },
  'en-US': {
    show: 'Show Main Window',
    quit: 'Quit'
  }
} as const;

let fullscreenMonitorTimer: number | null = null;
let fullscreenMonitorActive = false;
let fullscreenSuppressed = false;
let fullscreenCheckInFlight = false;
let fullscreenSettingsResolver: (() => AppSettings) | null = null;

function resolveTrayText(language: AppSettings['language']) {
  return TRAY_TEXT[language] ?? TRAY_TEXT['en-US'];
}

type NativeTaskbarPrefs = {
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
};

const DEFAULT_NATIVE_TASKBAR_PREFS: NativeTaskbarPrefs = {
  showCpu: true,
  showCpuFreq: true,
  showCpuTemp: true,
  showGpu: true,
  showGpuTemp: true,
  showMemory: true,
  showApp: true,
  showDown: true,
  showUp: true,
  showLatency: false,
  twoLineMode: false,
  backgroundMode: 'transparent'
};

function readNativeTaskbarPrefs(): NativeTaskbarPrefs {
  const parsed = storageRepository.getJsonSync<Partial<NativeTaskbarPrefs>>(storageKeys.taskbarPrefs);
  const prefs = parsed ?? {};
  return {
    showCpu: prefs.showCpu ?? DEFAULT_NATIVE_TASKBAR_PREFS.showCpu,
    showCpuFreq: prefs.showCpuFreq ?? DEFAULT_NATIVE_TASKBAR_PREFS.showCpuFreq,
    showCpuTemp: prefs.showCpuTemp ?? DEFAULT_NATIVE_TASKBAR_PREFS.showCpuTemp,
    showGpu: prefs.showGpu ?? DEFAULT_NATIVE_TASKBAR_PREFS.showGpu,
    showGpuTemp: prefs.showGpuTemp ?? DEFAULT_NATIVE_TASKBAR_PREFS.showGpuTemp,
    showMemory: prefs.showMemory ?? DEFAULT_NATIVE_TASKBAR_PREFS.showMemory,
    showApp: prefs.showApp ?? DEFAULT_NATIVE_TASKBAR_PREFS.showApp,
    showDown: prefs.showDown ?? DEFAULT_NATIVE_TASKBAR_PREFS.showDown,
    showUp: prefs.showUp ?? DEFAULT_NATIVE_TASKBAR_PREFS.showUp,
    showLatency: prefs.showLatency ?? DEFAULT_NATIVE_TASKBAR_PREFS.showLatency,
    twoLineMode: prefs.twoLineMode ?? DEFAULT_NATIVE_TASKBAR_PREFS.twoLineMode,
    backgroundMode:
      prefs.backgroundMode === 'dark' ||
      prefs.backgroundMode === 'light' ||
      prefs.backgroundMode === 'transparent'
        ? prefs.backgroundMode
        : DEFAULT_NATIVE_TASKBAR_PREFS.backgroundMode
  };
}

function buildNativeTaskbarConfig(settings: AppSettings) {
  const prefs = readNativeTaskbarPrefs();
  return {
    language: settings.language,
    alwaysOnTop: settings.taskbarAlwaysOnTop,
    autoHideOnFullscreen: settings.taskbarAutoHideOnFullscreen,
    rememberPosition: settings.rememberOverlayPosition,
    positionLocked: settings.taskbarPositionLocked,
    showCpu: prefs.showCpu,
    showCpuFreq: prefs.showCpuFreq,
    showCpuTemp: prefs.showCpuTemp,
    showGpu: prefs.showGpu,
    showGpuTemp: prefs.showGpuTemp,
    showMemory: prefs.showMemory,
    showApp: prefs.showApp,
    showDown: prefs.showDown,
    showUp: prefs.showUp,
    showLatency: prefs.showLatency,
    twoLineMode: prefs.twoLineMode,
    backgroundMode: prefs.backgroundMode
  };
}

export const useWindowStore = defineStore('window', {
  state: () => ({
    trayReady: false
  }),
  actions: {
    async toggleOverlay(visible: boolean) {
      if (!inTauri()) {
        return;
      }
      await api.toggleOverlay(visible);
    },
    async ensureMainWindow(settings: AppSettings) {
      if (!inTauri()) {
        return;
      }
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const existing = await WebviewWindow.getByLabel('main');
        if (existing) {
          try {
            await existing.show();
            await existing.setFocus();
          } catch {
            // ignore
          }
          return;
        }

        const created = new WebviewWindow('main', {
          url: 'index.html',
          title: 'PulseCoreLite Overlay',
          width: 340,
          height: 260,
          resizable: false,
          maximizable: false,
          minimizable: true,
          decorations: false,
          transparent: true,
          alwaysOnTop: settings.overlayAlwaysOnTop,
          visible: true,
          skipTaskbar: false
        });
        try {
          await created.show();
          await created.setFocus();
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    },
    async closeMainWindow() {
      if (!inTauri()) {
        return;
      }
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const existing = await WebviewWindow.getByLabel('main');
        if (!existing) {
          return;
        }
        try {
          await existing.close();
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    },
    async ensureTray(settings: AppSettings) {
      if (!inTauri() || this.trayReady) {
        return true;
      }
      try {
        const [{ TrayIcon }, { Menu }, { defaultWindowIcon }] = await Promise.all([
          import('@tauri-apps/api/tray'),
          import('@tauri-apps/api/menu'),
          import('@tauri-apps/api/app')
        ]);
        const showWindow = async () => {
          await this.ensureMainWindow(settings);
        };
        const exitApp = async () => {
          await api.exitApp();
        };
        const trayText = resolveTrayText(settings.language);
        const menu = await Menu.new({
          items: [
            { id: 'show', text: trayText.show, action: showWindow },
            { id: 'quit', text: trayText.quit, action: exitApp }
          ]
        });
        const icon = await defaultWindowIcon();
        const trayOptions: Parameters<typeof TrayIcon.new>[0] = {
          menu,
          menuOnLeftClick: true,
          tooltip: 'PulseCoreLite',
          action: async event => {
            if (event.type === 'DoubleClick') {
              await showWindow();
            }
          }
        };
        if (icon) {
          trayOptions.icon = icon;
        }
        await TrayIcon.new(trayOptions);
        this.trayReady = true;
        return true;
      } catch {
        return false;
      }
    },
    async handoffTrayToOtherWindow(): Promise<boolean> {
      if (!inTauri()) {
        return false;
      }
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        for (const label of ['taskbar', 'toolkit']) {
          const existing = await WebviewWindow.getByLabel(label);
          if (!existing) {
            continue;
          }
          try {
            await getCurrentWindow().emitTo(label, 'pulsecorelite://ensure-tray', null);
            return true;
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      return false;
    },
    async minimizeToTray(settings: AppSettings) {
      if (!inTauri()) {
        return;
      }
      await this.ensureTray(settings);
      const canHandoff = await this.handoffTrayToOtherWindow();
      if (canHandoff) {
        await this.closeMainWindow();
        return;
      }
      await this.toggleOverlay(false);
    },
    async minimizeOverlay() {
      if (!inTauri()) {
        return;
      }
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    },
    async ensureTaskbarFullscreenMonitor(resolveSettings: () => AppSettings) {
      if (!inTauri()) {
        return;
      }
      const settings = resolveSettings();
      const shouldRun = settings.taskbarMonitorEnabled && settings.taskbarAutoHideOnFullscreen;
      if (shouldRun) {
        this.startTaskbarFullscreenMonitor(resolveSettings);
      } else {
        this.stopTaskbarFullscreenMonitor(settings.taskbarMonitorEnabled);
      }
    },
    startTaskbarFullscreenMonitor(resolveSettings: () => AppSettings) {
      if (!inTauri() || typeof window === 'undefined') {
        return;
      }
      fullscreenSettingsResolver = resolveSettings;
      if (fullscreenMonitorTimer != null) {
        fullscreenMonitorActive = true;
        return;
      }
      fullscreenMonitorActive = true;
      const poll = async () => {
        if (!fullscreenMonitorActive || !inTauri()) {
          return;
        }
        if (fullscreenCheckInFlight) {
          return;
        }
        fullscreenCheckInFlight = true;
        try {
          const settings = fullscreenSettingsResolver?.();
          if (!settings) {
            return;
          }
          const monitorEnabled = settings.taskbarMonitorEnabled;
          const autoHide = settings.taskbarAutoHideOnFullscreen;
          if (!monitorEnabled || !autoHide) {
            if (fullscreenSuppressed) {
              fullscreenSuppressed = false;
              if (monitorEnabled) {
                await this.openTaskbarMonitor(settings);
              }
            }
            return;
          }

          const isFullscreen = await api.isFullscreenWindowActive();
          if (!fullscreenMonitorActive) {
            return;
          }
          if (isFullscreen && !fullscreenSuppressed) {
            fullscreenSuppressed = true;
            await this.closeTaskbarMonitor();
          } else if (!isFullscreen && fullscreenSuppressed) {
            fullscreenSuppressed = false;
            await this.openTaskbarMonitor(settings);
          }
        } catch {
          // ignore
        } finally {
          fullscreenCheckInFlight = false;
        }
      };

      fullscreenMonitorTimer = window.setInterval(() => {
        void poll();
      }, FULLSCREEN_POLL_MS);
      void poll();
    },
    stopTaskbarFullscreenMonitor(restoreIfHidden = false, restoreSettings?: AppSettings) {
      const settings = restoreSettings ?? fullscreenSettingsResolver?.() ?? null;
      fullscreenMonitorActive = false;
      if (fullscreenMonitorTimer != null && typeof window !== 'undefined') {
        window.clearInterval(fullscreenMonitorTimer);
        fullscreenMonitorTimer = null;
      }
      fullscreenCheckInFlight = false;
      if (fullscreenSuppressed) {
        fullscreenSuppressed = false;
        if (restoreIfHidden && settings) {
          void this.openTaskbarMonitor(settings);
        }
      }
      fullscreenSettingsResolver = null;
    },
    async ensureTaskbarMonitor(settings: AppSettings) {
      if (!inTauri()) {
        return;
      }
      if (settings.taskbarMonitorEnabled) {
        await this.openTaskbarMonitor(settings);
      } else {
        await this.closeTaskbarMonitor();
      }
    },
    async syncNativeTaskbarMonitor(settings: AppSettings) {
      if (!inTauri()) {
        return;
      }
      await api.configureNativeTaskbarMonitor(settings.nativeTaskbarMonitorEnabled, buildNativeTaskbarConfig(settings));
    },
    async openTaskbarMonitor(settings: AppSettings) {
      if (!inTauri()) {
        return;
      }

      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { primaryMonitor } = await import('@tauri-apps/api/window');

      const existing = await WebviewWindow.getByLabel('taskbar');
      if (existing) {
        try {
          await existing.show();
        } catch {
          // ignore
        }
        return;
      }

      const monitor = await primaryMonitor();
      const scale = monitor?.scaleFactor ?? 1;
      const info = await api.getTaskbarInfo();

      const taskbarHeightPx = info ? Math.abs(info.bottom - info.top) : 48;
      const height = Math.max(24, Math.round(taskbarHeightPx / scale));
      const width = 520;

      let x: number | undefined;
      let y: number | undefined;
      if (info) {
        const left = info.left / scale;
        const top = info.top / scale;
        const right = info.right / scale;
        const bottom = info.bottom / scale;

        if (info.edge === 3) {
          x = Math.round(right - width - 8);
          y = Math.round(top - height);
        } else if (info.edge === 1) {
          x = Math.round(right - width - 8);
          y = Math.round(bottom);
        } else if (info.edge === 0) {
          x = Math.round(right);
          y = Math.round(bottom - height - 8);
        } else if (info.edge === 2) {
          x = Math.round(left - width);
          y = Math.round(bottom - height - 8);
        }
      }

      new WebviewWindow('taskbar', {
        url: 'taskbar.html',
        title: 'PulseCoreLite Taskbar Monitor',
        width,
        height,
        x,
        y,
        transparent: true,
        decorations: false,
        alwaysOnTop: settings.taskbarAlwaysOnTop,
        skipTaskbar: true,
        visible: true,
        focus: false,
        resizable: false,
        maximizable: false,
        minimizable: false,
        closable: true
      });
    },
    async closeTaskbarMonitor() {
      if (!inTauri()) {
        return;
      }
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existing = await WebviewWindow.getByLabel('taskbar');
      if (!existing) {
        return;
      }
      try {
        await existing.close();
      } catch {
        // ignore
      }
    },
    async closeToolkitWindow() {
      if (!inTauri()) {
        return;
      }
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existing = await WebviewWindow.getByLabel('toolkit');
      if (!existing) {
        return;
      }
      try {
        await existing.close();
      } catch {
        // ignore
      }
    }
  }
});
