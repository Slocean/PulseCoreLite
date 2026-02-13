import { defineStore } from "pinia";
import { api, inTauri, listenEvent } from "../services/tauri";
import type { AppBootstrap, AppSettings, HardwareInfo, TelemetrySnapshot } from "../types";

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

function defaultSettings(): AppSettings {
  return {
    language: "zh-CN"
  };
}

function mockHardware(): HardwareInfo {
  return {
    cpu_model: "Mock CPU",
    cpu_max_freq_mhz: 4500,
    gpu_model: "N/A",
    ram_spec: "16GB",
    disk_models: ["Mock NVMe"],
    motherboard: "N/A",
    device_brand: "PulseCore Dev"
  };
}

export const useAppStore = defineStore("app", {
  state: () => ({
    ready: false,
    bootstrapped: false,
    snapshot: emptySnapshot(),
    hardwareInfo: mockHardware(),
    settings: defaultSettings(),
    unlisteners: [] as Array<() => void>
  }),
  actions: {
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = snapshot;
    },
    applyBootstrap(payload: AppBootstrap) {
      this.settings = payload.settings ?? defaultSettings();
      this.hardwareInfo = payload.hardware_info ?? mockHardware();
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
          hardware_info: mockHardware(),
          settings: defaultSettings()
        });
        this.bootstrapMockFeed();
      }

      this.bootstrapped = true;
      this.ready = true;
    },
    async bindEvents() {
      this.unlisteners.push(
        await listenEvent<TelemetrySnapshot>("telemetry://snapshot", payload => this.pushSnapshot(payload))
      );
    },
    bootstrapMockFeed() {
      setInterval(() => {
        const next: TelemetrySnapshot = {
          ...this.snapshot,
          timestamp: new Date().toISOString(),
          cpu: {
            ...this.snapshot.cpu,
            usage_pct: Math.max(5, Math.min(90, this.snapshot.cpu.usage_pct + (Math.random() * 16 - 8))),
            frequency_mhz: 4200,
            temperature_c: 40 + Math.random() * 20
          },
          gpu: {
            ...this.snapshot.gpu,
            usage_pct: Math.max(3, Math.min(95, (this.snapshot.gpu.usage_pct ?? 30) + (Math.random() * 18 - 9))),
            memory_total_mb: 8192,
            memory_used_mb: 2400 + Math.random() * 800,
            frequency_mhz: 1500 + Math.random() * 200
          },
          memory: {
            ...this.snapshot.memory,
            total_mb: 32768,
            used_mb: 13000 + Math.random() * 3000,
            usage_pct: 42 + Math.random() * 10
          },
          disks: [
            {
              name: "C:\\",
              label: "System",
              total_gb: 2000,
              used_gb: 960,
              usage_pct: 48,
              read_bytes_per_sec: Math.random() * 120_000_000,
              write_bytes_per_sec: Math.random() * 80_000_000
            },
            {
              name: "D:\\",
              label: "Data",
              total_gb: 4000,
              used_gb: 2000,
              usage_pct: 50,
              read_bytes_per_sec: 0,
              write_bytes_per_sec: 0
            }
          ],
          network: {
            download_bytes_per_sec: Math.random() * 65_000_000,
            upload_bytes_per_sec: Math.random() * 24_000_000,
            latency_ms: 12 + Math.random() * 5
          }
        };
        this.pushSnapshot(next);
      }, 500);
    },
    async toggleOverlay(visible: boolean) {
      if (!inTauri()) {
        return;
      }
      await api.toggleOverlay(visible);
    },
    dispose() {
      this.unlisteners.forEach(fn => fn());
      this.unlisteners = [];
    }
  }
});
