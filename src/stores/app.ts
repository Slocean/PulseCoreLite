import { defineStore } from 'pinia';
import { api, inTauri, listenEvent } from '../services/tauri';
import type { AppBootstrap, AppSettings, HardwareInfo, TelemetrySnapshot } from '../types';

const SETTINGS_KEY = 'pulsecorelite.settings';
const HARDWARE_KEY = 'pulsecorelite.hardware_info';
const OVERLAY_POS_KEY = 'pulsecorelite.overlay_pos';

function emptySnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    cpu: { usage_pct: 0, frequency_mhz: null, temperature_c: null },
    gpu: {
      usage_pct: null,
      temperature_c: null,
      memory_used_mb: null,
      memory_total_mb: null,
      frequency_mhz: null
    },
    memory: { used_mb: 0, total_mb: 1, usage_pct: 0 },
    disks: [],
    network: { download_bytes_per_sec: 0, upload_bytes_per_sec: 0, latency_ms: null },
    power_watts: null
  };
}

function readStoredSettings(): Partial<AppSettings> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const hasOwn = (key: keyof AppSettings) => Object.prototype.hasOwnProperty.call(parsed, key);
    const hasLanguage = parsed.language === 'zh-CN' || parsed.language === 'en-US';
    const hasCloseToTray = typeof parsed.closeToTray === 'boolean';
    const hasRememberOverlayPosition =
      hasOwn('rememberOverlayPosition') && typeof parsed.rememberOverlayPosition === 'boolean';
    const hasTaskbarMonitorEnabled =
      hasOwn('taskbarMonitorEnabled') && typeof parsed.taskbarMonitorEnabled === 'boolean';
    const hasTaskbarAlwaysOnTop = hasOwn('taskbarAlwaysOnTop') && typeof parsed.taskbarAlwaysOnTop === 'boolean';
    const hasFactoryResetHotkey =
      hasOwn('factoryResetHotkey') &&
      (parsed.factoryResetHotkey == null || typeof parsed.factoryResetHotkey === 'string');

    if (
      hasLanguage ||
      hasCloseToTray ||
      hasRememberOverlayPosition ||
      hasTaskbarMonitorEnabled ||
      hasTaskbarAlwaysOnTop ||
      hasFactoryResetHotkey
    ) {
      return {
        ...(hasLanguage ? { language: parsed.language } : {}),
        ...(hasCloseToTray ? { closeToTray: parsed.closeToTray } : {}),
        ...(hasRememberOverlayPosition ? { rememberOverlayPosition: parsed.rememberOverlayPosition } : {}),
        ...(hasTaskbarMonitorEnabled ? { taskbarMonitorEnabled: parsed.taskbarMonitorEnabled } : {}),
        ...(hasTaskbarAlwaysOnTop ? { taskbarAlwaysOnTop: parsed.taskbarAlwaysOnTop } : {}),
        ...(hasFactoryResetHotkey ? { factoryResetHotkey: parsed.factoryResetHotkey ?? null } : {})
      };
    }
    return null;
  } catch {
    return null;
  }
}

function resolveSettings(settings?: AppSettings | null): AppSettings {
  const fallback: AppSettings = {
    language: 'zh-CN',
    closeToTray: false,
    rememberOverlayPosition: true,
    taskbarMonitorEnabled: false,
    taskbarAlwaysOnTop: true,
    factoryResetHotkey: null
  };

  const candidate = settings ?? fallback;
  const base: AppSettings = {
    language: candidate.language === 'en-US' ? 'en-US' : 'zh-CN',
    closeToTray: typeof candidate.closeToTray === 'boolean' ? candidate.closeToTray : fallback.closeToTray,
    rememberOverlayPosition:
      typeof candidate.rememberOverlayPosition === 'boolean'
        ? candidate.rememberOverlayPosition
        : fallback.rememberOverlayPosition,
    taskbarMonitorEnabled:
      typeof candidate.taskbarMonitorEnabled === 'boolean'
        ? candidate.taskbarMonitorEnabled
        : fallback.taskbarMonitorEnabled,
    taskbarAlwaysOnTop:
      typeof candidate.taskbarAlwaysOnTop === 'boolean' ? candidate.taskbarAlwaysOnTop : fallback.taskbarAlwaysOnTop,
    factoryResetHotkey:
      candidate.factoryResetHotkey == null || typeof candidate.factoryResetHotkey === 'string'
        ? candidate.factoryResetHotkey
        : fallback.factoryResetHotkey
  };

  const stored = readStoredSettings();
  if (!stored) {
    return base;
  }
  return {
    ...base,
    language: stored.language ?? base.language,
    closeToTray: stored.closeToTray ?? base.closeToTray,
    rememberOverlayPosition: stored.rememberOverlayPosition ?? base.rememberOverlayPosition,
    taskbarMonitorEnabled: stored.taskbarMonitorEnabled ?? base.taskbarMonitorEnabled,
    taskbarAlwaysOnTop: stored.taskbarAlwaysOnTop ?? base.taskbarAlwaysOnTop,
    factoryResetHotkey: stored.factoryResetHotkey ?? base.factoryResetHotkey
  };
}

function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function defaultSettings(): AppSettings {
  return resolveSettings();
}

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
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await Promise.allSettled([
      win.emitTo('main', 'pulsecorelite://settings-sync', null),
      win.emitTo('taskbar', 'pulsecorelite://settings-sync', null)
    ]);
  } catch {
    // ignore
  }
}

function emptyHardware(): HardwareInfo {
  return {
    cpu_model: '',
    cpu_max_freq_mhz: null,
    gpu_model: '',
    ram_spec: '',
    disk_models: [],
    motherboard: '',
    device_brand: ''
  };
}

function readStoredHardwareInfo(): HardwareInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(HARDWARE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as HardwareInfo;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      cpu_model: parsed.cpu_model ?? '',
      cpu_max_freq_mhz: parsed.cpu_max_freq_mhz ?? null,
      gpu_model: parsed.gpu_model ?? '',
      ram_spec: parsed.ram_spec ?? '',
      disk_models: Array.isArray(parsed.disk_models) ? parsed.disk_models : [],
      motherboard: parsed.motherboard ?? '',
      device_brand: parsed.device_brand ?? ''
    };
  } catch {
    return null;
  }
}

function persistHardwareInfo(info: HardwareInfo) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(HARDWARE_KEY, JSON.stringify(info));
}

function resolveHardwareInfo(payload?: HardwareInfo | null): HardwareInfo {
  const stored = readStoredHardwareInfo();
  const fallback = stored ?? emptyHardware();
  if (!payload) {
    return fallback;
  }
  const hasData =
    payload.cpu_model ||
    payload.gpu_model ||
    payload.ram_spec ||
    payload.disk_models.length > 0 ||
    payload.motherboard ||
    payload.device_brand;
  return hasData ? payload : fallback;
}

export const useAppStore = defineStore('app', {
  state: () => ({
    ready: false,
    bootstrapped: false,
    snapshot: emptySnapshot(),
    hardwareInfo: readStoredHardwareInfo() ?? emptyHardware(),
    settings: defaultSettings(),
    unlisteners: [] as Array<() => void>,
    trayReady: false
  }),
  actions: {
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = snapshot;
    },
    applyBootstrap(payload: AppBootstrap) {
      this.settings = resolveSettings(payload.settings);
      this.hardwareInfo = resolveHardwareInfo(payload.hardware_info);
      this.pushSnapshot(payload.latest_snapshot ?? emptySnapshot());
    },
    async bootstrap() {
      if (this.bootstrapped) {
        return;
      }

      if (inTauri()) {
        const bootstrap = await api.getInitialState();
        this.applyBootstrap(bootstrap);
        const label = await getCurrentWindowLabel();
        if (label === 'main') {
          void this.ensureTray();
          void this.ensureTaskbarMonitor();
        }
        await this.bindEvents();
        void this.refreshHardwareInfo();
      } else {
        this.applyBootstrap({
          latest_snapshot: emptySnapshot(),
          hardware_info: emptyHardware(),
          settings: defaultSettings()
        });
      }

      this.bootstrapped = true;
      this.ready = true;
    },
    async refreshHardwareInfo() {
      if (!inTauri()) {
        return;
      }
      try {
        const info = await api.getHardwareInfo();
        this.hardwareInfo = info;
        persistHardwareInfo(info);
      } catch {
        return;
      }
    },
    async bindEvents() {
      this.unlisteners.push(
        await listenEvent<TelemetrySnapshot>('telemetry://snapshot', payload => this.pushSnapshot(payload))
      );
      this.unlisteners.push(
        await listenEvent<null>('pulsecorelite://settings-sync', () => {
          // Another window updated persisted settings; re-hydrate from storage.
          this.settings = resolveSettings(this.settings);
        })
      );
    },
    async toggleOverlay(visible: boolean) {
      if (!inTauri()) {
        return;
      }
      await api.toggleOverlay(visible);
    },
    async setRefreshRate(rateMs: number) {
      if (!inTauri()) {
        return;
      }
      await api.setRefreshRate(rateMs);
    },
    setLanguage(language: AppSettings['language']) {
      if (this.settings.language === language) {
        return;
      }
      this.settings = {
        ...this.settings,
        language
      };
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    setCloseToTray(closeToTray: boolean) {
      if (this.settings.closeToTray === closeToTray) {
        return;
      }
      this.settings = {
        ...this.settings,
        closeToTray
      };
      persistSettings(this.settings);
      void broadcastSettingsSync();
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
        window.localStorage.removeItem(OVERLAY_POS_KEY);
      }
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    setTaskbarAlwaysOnTop(taskbarAlwaysOnTop: boolean) {
      if (this.settings.taskbarAlwaysOnTop === taskbarAlwaysOnTop) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarAlwaysOnTop
      };
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    async setTaskbarMonitorEnabled(taskbarMonitorEnabled: boolean) {
      if (this.settings.taskbarMonitorEnabled === taskbarMonitorEnabled) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarMonitorEnabled
      };
      persistSettings(this.settings);

      if (!inTauri()) {
        return;
      }

      const label = await getCurrentWindowLabel();
      if (label === 'main') {
        await this.ensureTaskbarMonitor();
        return;
      }

      // Non-main windows: ask main to re-sync its settings state.
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().emitTo('main', 'pulsecorelite://settings-sync', null);
      } catch {
        // best-effort; ignore
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
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    factoryReset() {
      if (typeof window === 'undefined') {
        return;
      }
      // Factory reset: clear all persisted local data.
      window.localStorage.clear();
      window.location.reload();
    },
    async ensureTray() {
      if (!inTauri() || this.trayReady) {
        return;
      }
      const [{ TrayIcon }, { Menu }, { defaultWindowIcon }] = await Promise.all([
        import('@tauri-apps/api/tray'),
        import('@tauri-apps/api/menu'),
        import('@tauri-apps/api/app')
      ]);
      const showWindow = async () => {
        await this.toggleOverlay(true);
      };
      const exitApp = async () => {
        await this.exitApp();
      };
      const menu = await Menu.new({
        items: [
          { id: 'show', text: '显示主窗口', action: showWindow },
          { id: 'quit', text: '退出', action: exitApp }
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
    },
    async minimizeToTray() {
      if (!inTauri()) {
        return;
      }
      await this.ensureTray();
      await this.toggleOverlay(false);
    },
    async minimizeOverlay() {
      if (!inTauri()) {
        return;
      }
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    },
    async ensureTaskbarMonitor() {
      if (!inTauri()) {
        return;
      }
      if (this.settings.taskbarMonitorEnabled) {
        await this.openTaskbarMonitor();
      } else {
        await this.closeTaskbarMonitor();
      }
    },
    async openTaskbarMonitor() {
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

      // Start with a sane width; the taskbar window will auto-size to its content.
      const width = 520;

      // Best-effort initial position: just above the taskbar (common bottom taskbar case).
      let x: number | undefined;
      let y: number | undefined;
      if (info) {
        const left = info.left / scale;
        const top = info.top / scale;
        const right = info.right / scale;
        const bottom = info.bottom / scale;

        // ABE_BOTTOM=3, ABE_TOP=1, ABE_LEFT=0, ABE_RIGHT=2
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

      // Create the window (index.html is used; the app selects UI by window label).
      // Note: keep it small and non-invasive; users can drag to their preferred spot.
      new WebviewWindow('taskbar', {
        url: 'index.html',
        title: 'PulseCoreLite Taskbar Monitor',
        width,
        height,
        x,
        y,
        transparent: true,
        decorations: false,
        alwaysOnTop: this.settings.taskbarAlwaysOnTop,
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
    async exitApp() {
      if (!inTauri()) {
        return;
      }
      await api.exitApp();
    },
    dispose() {
      this.unlisteners.forEach(fn => fn());
      this.unlisteners = [];
    }
  }
});
