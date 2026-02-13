import { defineStore } from 'pinia';
import { api, inTauri, listenEvent } from '../services/tauri';
import type { AppBootstrap, AppSettings, HardwareInfo, TelemetrySnapshot } from '../types';

const SETTINGS_KEY = 'pulsecorelite.settings';

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
    if (parsed.language === 'zh-CN' || parsed.language === 'en-US') {
      return { language: parsed.language };
    }
    return null;
  } catch {
    return null;
  }
}

function resolveSettings(settings?: AppSettings | null): AppSettings {
  const base = settings ?? { language: 'zh-CN' };
  const stored = readStoredSettings();
  if (!stored) {
    return base;
  }
  return {
    ...base,
    language: stored.language ?? base.language
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

export const useAppStore = defineStore('app', {
  state: () => ({
    ready: false,
    bootstrapped: false,
    snapshot: emptySnapshot(),
    hardwareInfo: emptyHardware(),
    settings: defaultSettings(),
    unlisteners: [] as Array<() => void>
  }),
  actions: {
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = snapshot;
    },
    applyBootstrap(payload: AppBootstrap) {
      this.settings = resolveSettings(payload.settings);
      this.hardwareInfo = payload.hardware_info ?? emptyHardware();
      this.pushSnapshot(payload.latest_snapshot ?? emptySnapshot());
    },
    async bootstrap() {
      if (this.bootstrapped) {
        return;
      }

      if (inTauri()) {
        const bootstrap = await api.getInitialState();
        this.applyBootstrap(bootstrap);
        await this.bindEvents();
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
    async bindEvents() {
      this.unlisteners.push(
        await listenEvent<TelemetrySnapshot>('telemetry://snapshot', payload => this.pushSnapshot(payload))
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
    },
    dispose() {
      this.unlisteners.forEach(fn => fn());
      this.unlisteners = [];
    }
  }
});
