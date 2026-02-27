import { defineStore } from 'pinia';
import { markRaw, watch } from 'vue';
import { api, inTauri, listenEvent } from '../services/tauri';
import type { AppBootstrap, AppSettings, HardwareInfo, TelemetrySnapshot } from '../types';
import { kvResetAll } from '../utils/kv';

const SETTINGS_KEY = 'pulsecorelite.settings';
const HARDWARE_KEY = 'pulsecorelite.hardware_info';
const OVERLAY_POS_KEY = 'pulsecorelite.overlay_pos';
const FULLSCREEN_POLL_MS = 800;

let fullscreenMonitorTimer: number | null = null;
let fullscreenMonitorActive = false;
let fullscreenSuppressed = false;
let fullscreenCheckInFlight = false;

function emptySnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    cpu: { usage_pct: 0, frequency_mhz: null, temperature_c: null },
    gpu: {
      usage_pct: 0,
      temperature_c: null,
      memory_used_mb: null,
      memory_total_mb: null,
      frequency_mhz: null
    },
    memory: { used_mb: 0, total_mb: 1, usage_pct: 0 },
    disks: [],
    network: { download_bytes_per_sec: 0, upload_bytes_per_sec: 0, latency_ms: null },
    appCpuUsagePct: 0,
    appMemoryMb: null,
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
    const hasAutoStartEnabled = hasOwn('autoStartEnabled') && typeof parsed.autoStartEnabled === 'boolean';
    const hasRememberOverlayPosition =
      hasOwn('rememberOverlayPosition') && typeof parsed.rememberOverlayPosition === 'boolean';
    const hasOverlayAlwaysOnTop = hasOwn('overlayAlwaysOnTop') && typeof parsed.overlayAlwaysOnTop === 'boolean';
    const hasTaskbarMonitorEnabled =
      hasOwn('taskbarMonitorEnabled') && typeof parsed.taskbarMonitorEnabled === 'boolean';
    const hasTaskbarAlwaysOnTop = hasOwn('taskbarAlwaysOnTop') && typeof parsed.taskbarAlwaysOnTop === 'boolean';
    const hasTaskbarAutoHideOnFullscreen =
      hasOwn('taskbarAutoHideOnFullscreen') && typeof parsed.taskbarAutoHideOnFullscreen === 'boolean';
    const hasFactoryResetHotkey =
      hasOwn('factoryResetHotkey') &&
      (parsed.factoryResetHotkey == null || typeof parsed.factoryResetHotkey === 'string');

    if (
      hasLanguage ||
      hasCloseToTray ||
      hasAutoStartEnabled ||
      hasRememberOverlayPosition ||
      hasOverlayAlwaysOnTop ||
      hasTaskbarMonitorEnabled ||
      hasTaskbarAlwaysOnTop ||
      hasTaskbarAutoHideOnFullscreen ||
      hasFactoryResetHotkey
    ) {
      return {
        ...(hasLanguage ? { language: parsed.language } : {}),
        ...(hasCloseToTray ? { closeToTray: parsed.closeToTray } : {}),
        ...(hasAutoStartEnabled ? { autoStartEnabled: parsed.autoStartEnabled } : {}),
        ...(hasRememberOverlayPosition ? { rememberOverlayPosition: parsed.rememberOverlayPosition } : {}),
        ...(hasOverlayAlwaysOnTop ? { overlayAlwaysOnTop: parsed.overlayAlwaysOnTop } : {}),
        ...(hasTaskbarMonitorEnabled ? { taskbarMonitorEnabled: parsed.taskbarMonitorEnabled } : {}),
        ...(hasTaskbarAlwaysOnTop ? { taskbarAlwaysOnTop: parsed.taskbarAlwaysOnTop } : {}),
        ...(hasTaskbarAutoHideOnFullscreen
          ? { taskbarAutoHideOnFullscreen: parsed.taskbarAutoHideOnFullscreen }
          : {}),
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
    autoStartEnabled: false,
    rememberOverlayPosition: true,
    overlayAlwaysOnTop: true,
    taskbarMonitorEnabled: false,
    taskbarAlwaysOnTop: true,
    taskbarAutoHideOnFullscreen: false,
    factoryResetHotkey: null
  };

  const candidate = settings ?? fallback;
  const base: AppSettings = {
    language: candidate.language === 'en-US' ? 'en-US' : 'zh-CN',
    closeToTray: typeof candidate.closeToTray === 'boolean' ? candidate.closeToTray : fallback.closeToTray,
    autoStartEnabled:
      typeof candidate.autoStartEnabled === 'boolean' ? candidate.autoStartEnabled : fallback.autoStartEnabled,
    rememberOverlayPosition:
      typeof candidate.rememberOverlayPosition === 'boolean'
        ? candidate.rememberOverlayPosition
        : fallback.rememberOverlayPosition,
    overlayAlwaysOnTop:
      typeof candidate.overlayAlwaysOnTop === 'boolean' ? candidate.overlayAlwaysOnTop : fallback.overlayAlwaysOnTop,
    taskbarMonitorEnabled:
      typeof candidate.taskbarMonitorEnabled === 'boolean'
        ? candidate.taskbarMonitorEnabled
        : fallback.taskbarMonitorEnabled,
    taskbarAlwaysOnTop:
      typeof candidate.taskbarAlwaysOnTop === 'boolean'
        ? candidate.taskbarAlwaysOnTop
        : fallback.taskbarAlwaysOnTop,
    taskbarAutoHideOnFullscreen:
      typeof candidate.taskbarAutoHideOnFullscreen === 'boolean'
        ? candidate.taskbarAutoHideOnFullscreen
        : fallback.taskbarAutoHideOnFullscreen,
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
    autoStartEnabled: stored.autoStartEnabled ?? base.autoStartEnabled,
    rememberOverlayPosition: stored.rememberOverlayPosition ?? base.rememberOverlayPosition,
    overlayAlwaysOnTop: stored.overlayAlwaysOnTop ?? base.overlayAlwaysOnTop,
    taskbarMonitorEnabled: stored.taskbarMonitorEnabled ?? base.taskbarMonitorEnabled,
    taskbarAlwaysOnTop: stored.taskbarAlwaysOnTop ?? base.taskbarAlwaysOnTop,
    taskbarAutoHideOnFullscreen: stored.taskbarAutoHideOnFullscreen ?? base.taskbarAutoHideOnFullscreen,
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
    snapshot: markRaw(emptySnapshot()),
    hardwareInfo: markRaw(readStoredHardwareInfo() ?? emptyHardware()),
    settings: defaultSettings(),
    installationMode: 'unknown' as 'unknown' | 'installed' | 'portable',
    unlisteners: [] as Array<() => void>,
    trayReady: false
  }),
  actions: {
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = markRaw(snapshot);
    },
    applyBootstrap(payload: AppBootstrap) {
      this.settings = resolveSettings(payload.settings);
      this.hardwareInfo = markRaw(resolveHardwareInfo(payload.hardware_info));
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
          void this.ensureTaskbarFullscreenMonitor();
          void this.syncAutoStartEnabled();
          void this.detectInstallationMode();
          this.unlisteners.push(
            watch(
              () => this.settings.taskbarMonitorEnabled,
              () => {
                void this.ensureTaskbarMonitor();
              }
            )
          );
          this.unlisteners.push(
            watch(
              () => [this.settings.taskbarMonitorEnabled, this.settings.taskbarAutoHideOnFullscreen],
              () => {
                void this.ensureTaskbarFullscreenMonitor();
              },
              { immediate: true }
            )
          );
        }
        await this.bindEvents();
        void this.refreshHardwareInfo();
      } else {
        this.applyBootstrap({
          latest_snapshot: emptySnapshot(),
          hardware_info: emptyHardware(),
          settings: defaultSettings()
        });
        this.installationMode = 'portable';
      }

      this.bootstrapped = true;
      this.ready = true;
    },
    async detectInstallationMode() {
      if (!inTauri()) {
        this.installationMode = 'portable';
        return;
      }
      try {
        this.installationMode = await api.getInstallationMode();
      } catch {
        this.installationMode = 'portable';
      }
    },
    async refreshHardwareInfo() {
      if (!inTauri()) {
        return;
      }
      try {
        const info = await api.getHardwareInfo();
        this.hardwareInfo = markRaw(info);
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
      this.unlisteners.push(
        await listenEvent<null>('pulsecorelite://ensure-tray', () => {
          void this.ensureTray();
        })
      );
    },
    async toggleOverlay(visible: boolean) {
      if (!inTauri()) {
        return;
      }
      await api.toggleOverlay(visible);
    },
    async ensureMainWindow() {
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
          alwaysOnTop: this.settings.overlayAlwaysOnTop,
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
    async setAutoStartEnabled(autoStartEnabled: boolean) {
      if (this.settings.autoStartEnabled === autoStartEnabled) {
        return;
      }
      const previous = this.settings.autoStartEnabled;
      this.settings = {
        ...this.settings,
        autoStartEnabled
      };
      persistSettings(this.settings);
      void broadcastSettingsSync();
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
          persistSettings(this.settings);
          void broadcastSettingsSync();
        }
      } catch {
        this.settings = {
          ...this.settings,
          autoStartEnabled: previous
        };
        persistSettings(this.settings);
        void broadcastSettingsSync();
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
        window.localStorage.removeItem(OVERLAY_POS_KEY);
      }
      persistSettings(this.settings);
      void broadcastSettingsSync();
    },
    setOverlayAlwaysOnTop(overlayAlwaysOnTop: boolean) {
      if (this.settings.overlayAlwaysOnTop === overlayAlwaysOnTop) {
        return;
      }
      this.settings = {
        ...this.settings,
        overlayAlwaysOnTop
      };
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
    setTaskbarAutoHideOnFullscreen(taskbarAutoHideOnFullscreen: boolean) {
      if (this.settings.taskbarAutoHideOnFullscreen === taskbarAutoHideOnFullscreen) {
        return;
      }
      this.settings = {
        ...this.settings,
        taskbarAutoHideOnFullscreen
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
          persistSettings(this.settings);
          void broadcastSettingsSync();
        }
      } catch {
        return;
      }
    },
    async factoryReset() {
      if (typeof window === 'undefined') {
        return;
      }
      // Factory reset: clear all persisted local data.
      await kvResetAll();
      window.localStorage.clear();
      window.location.reload();
    },
    async ensureTray(): Promise<boolean> {
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
        await this.ensureMainWindow();
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
    async minimizeToTray() {
      if (!inTauri()) {
        return;
      }
      await this.ensureTray();
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
    async ensureTaskbarFullscreenMonitor() {
      if (!inTauri()) {
        return;
      }
      const shouldRun = this.settings.taskbarMonitorEnabled && this.settings.taskbarAutoHideOnFullscreen;
      if (shouldRun) {
        this.startTaskbarFullscreenMonitor();
      } else {
        this.stopTaskbarFullscreenMonitor(this.settings.taskbarMonitorEnabled);
      }
    },
    startTaskbarFullscreenMonitor() {
      if (!inTauri() || typeof window === 'undefined') {
        return;
      }
      if (fullscreenMonitorTimer != null) {
        fullscreenMonitorActive = true;
        return;
      }
      fullscreenMonitorActive = true;
      const store = this;
      const poll = async () => {
        if (!fullscreenMonitorActive || !inTauri()) {
          return;
        }
        if (fullscreenCheckInFlight) {
          return;
        }
        fullscreenCheckInFlight = true;
        try {
          const monitorEnabled = store.settings.taskbarMonitorEnabled;
          const autoHide = store.settings.taskbarAutoHideOnFullscreen;
          if (!monitorEnabled || !autoHide) {
            if (fullscreenSuppressed) {
              fullscreenSuppressed = false;
              if (monitorEnabled) {
                await store.openTaskbarMonitor();
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
            await store.closeTaskbarMonitor();
          } else if (!isFullscreen && fullscreenSuppressed) {
            fullscreenSuppressed = false;
            await store.openTaskbarMonitor();
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
    stopTaskbarFullscreenMonitor(restoreIfHidden = false) {
      fullscreenMonitorActive = false;
      if (fullscreenMonitorTimer != null && typeof window !== 'undefined') {
        window.clearInterval(fullscreenMonitorTimer);
        fullscreenMonitorTimer = null;
      }
      fullscreenCheckInFlight = false;
      if (fullscreenSuppressed) {
        fullscreenSuppressed = false;
        if (restoreIfHidden) {
          void this.openTaskbarMonitor();
        }
      }
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

      // Create the window (taskbar.html loads the minimal taskbar UI).
      // Note: keep it small and non-invasive; users can drag to their preferred spot.
      new WebviewWindow('taskbar', {
        url: 'taskbar.html',
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
    },
    async exitApp() {
      if (!inTauri()) {
        return;
      }
      await api.exitApp();
    },
    async uninstallApp(title: string, message: string) {
      if (!inTauri()) {
        return;
      }
      await api.uninstallApp(title, message);
    },
    dispose() {
      this.stopTaskbarFullscreenMonitor();
      this.unlisteners.forEach(fn => fn());
      this.unlisteners = [];
    }
  }
});
