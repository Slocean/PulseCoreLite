import { defineStore } from "pinia";
import { api, inTauri, listenEvent } from "../services/tauri";
import type {
  AppBootstrap,
  AppSettings,
  HardwareInfo,
  HistoryFilter,
  HistoryPage,
  PingResult,
  SpeedTestConfig,
  SpeedTestProgress,
  SpeedTestResult,
  TelemetrySnapshot,
  WarningEvent
} from "../types";

const HISTORY_LIMIT = 120;

function emptySnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    cpu: { usage_pct: 0, frequency_mhz: null, temperature_c: null },
    gpu: { usage_pct: null, temperature_c: null, memory_used_mb: null, memory_total_mb: null },
    memory: { used_mb: 0, total_mb: 1, usage_pct: 0 },
    disk: { used_gb: 0, total_gb: 1, usage_pct: 0, read_bytes_per_sec: null, write_bytes_per_sec: null },
    network: { download_bytes_per_sec: 0, upload_bytes_per_sec: 0, latency_ms: null },
    power_watts: null
  };
}

function defaultSettings(): AppSettings {
  return {
    refresh_rate_ms: 500,
    low_power_rate_ms: 2000,
    module_toggles: {
      show_cpu: true,
      show_gpu: true,
      show_memory: true,
      show_disk: true,
      show_network: true
    },
    theme: "cyber-dark",
    accent: "#2b6cee",
    glass_opacity: 0.75,
    glow_intensity: 0.4,
    language: "zh-CN",
    speedtest_endpoints: [
      "https://speed.hetzner.de/100MB.bin",
      "https://proof.ovh.net/files/100Mb.dat"
    ],
    history_retention_days: 30,
    sensor_boost_enabled: false
  };
}

function mockHardware(): HardwareInfo {
  return {
    cpu_model: "Mock CPU",
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
    mode: "normal" as "normal" | "low_power",
    snapshot: emptySnapshot(),
    historySeries: [] as TelemetrySnapshot[],
    hardwareInfo: mockHardware(),
    settings: defaultSettings(),
    warnings: [] as WarningEvent[],
    activeSpeedTaskId: "" as string,
    speedProgress: null as SpeedTestProgress | null,
    lastSpeedResult: null as SpeedTestResult | null,
    lastPingResult: null as PingResult | null,
    historyPage: { total: 0, items: [] } as HistoryPage,
    unlisteners: [] as Array<() => void>
  }),
  getters: {
    cpuHistory(state): number[] {
      return state.historySeries.map((x) => x.cpu.usage_pct);
    },
    memoryHistory(state): number[] {
      return state.historySeries.map((x) => x.memory.usage_pct);
    },
    networkDownHistory(state): number[] {
      return state.historySeries.map((x) => x.network.download_bytes_per_sec / (1024 * 1024));
    }
  },
  actions: {
    pushWarning(warning: WarningEvent) {
      this.warnings.unshift(warning);
      this.warnings = this.warnings.slice(0, 16);
    },
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = snapshot;
      this.historySeries.push(snapshot);
      if (this.historySeries.length > HISTORY_LIMIT) {
        this.historySeries.shift();
      }
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
    applyBootstrap(payload: AppBootstrap) {
      this.settings = payload.settings;
      this.hardwareInfo = payload.hardware_info;
      this.pushSnapshot(payload.latest_snapshot);
    },
    async bindEvents() {
      this.unlisteners.push(
        await listenEvent<TelemetrySnapshot>("telemetry://snapshot", (payload) => this.pushSnapshot(payload))
      );
      this.unlisteners.push(
        await listenEvent<{ mode: "normal" | "low_power" }>("telemetry://mode_changed", (payload) => {
          this.mode = payload.mode;
        })
      );
      this.unlisteners.push(
        await listenEvent<WarningEvent>("system://warning", (payload) => this.pushWarning(payload))
      );
      this.unlisteners.push(
        await listenEvent<SpeedTestProgress>("network://speedtest_progress", (payload) => {
          if (payload.task_id === this.activeSpeedTaskId) {
            this.speedProgress = payload;
          }
        })
      );
      this.unlisteners.push(
        await listenEvent<SpeedTestResult>("network://speedtest_done", (payload) => {
          this.lastSpeedResult = payload;
          if (payload.task_id === this.activeSpeedTaskId) {
            this.activeSpeedTaskId = "";
          }
          this.speedProgress = null;
        })
      );
      this.unlisteners.push(
        await listenEvent<PingResult>("network://ping_done", (payload) => {
          this.lastPingResult = payload;
        })
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
            frequency_mhz: 4200
          },
          memory: {
            ...this.snapshot.memory,
            total_mb: 32768,
            used_mb: 13000 + Math.random() * 3000,
            usage_pct: 42 + Math.random() * 10
          },
          network: {
            download_bytes_per_sec: Math.random() * 65_000_000,
            upload_bytes_per_sec: Math.random() * 24_000_000,
            latency_ms: 12 + Math.random() * 5
          }
        };
        this.pushSnapshot(next);
      }, 500);
    },
    async updateSettings(patch: Partial<AppSettings>) {
      if (!inTauri()) {
        this.settings = { ...this.settings, ...patch };
        return;
      }
      this.settings = await api.updateSettings(patch);
    },
    async startSpeedTest(config: SpeedTestConfig) {
      if (!inTauri()) {
        this.lastSpeedResult = {
          task_id: "mock",
          endpoint: config.endpoint,
          download_mbps: 780,
          upload_mbps: null,
          latency_ms: 14,
          jitter_ms: 3,
          loss_pct: 0,
          started_at: new Date().toISOString(),
          duration_ms: 5000
        };
        return;
      }
      this.speedProgress = null;
      this.activeSpeedTaskId = await api.startSpeedTest(config);
    },
    async cancelSpeedTest() {
      if (!this.activeSpeedTaskId || !inTauri()) {
        return;
      }
      await api.cancelSpeedTest(this.activeSpeedTaskId);
      this.activeSpeedTaskId = "";
      this.speedProgress = null;
    },
    async runPing(target: string, count = 4) {
      if (!inTauri()) {
        this.lastPingResult = {
          target,
          min_ms: 10,
          max_ms: 18,
          avg_ms: 12,
          jitter_ms: 2,
          loss_pct: 0,
          samples: [10, 11, 12, 18]
        };
        return;
      }
      this.lastPingResult = await api.runPingTest(target, count);
    },
    async queryHistory(filter: HistoryFilter) {
      if (!inTauri()) {
        return;
      }
      this.historyPage = await api.queryHistory(filter);
    },
    async toggleOverlay(visible: boolean) {
      if (!inTauri()) {
        return;
      }
      await api.toggleOverlay(visible);
    },
    async setLowPowerMode(lowPower: boolean) {
      if (!inTauri()) {
        this.mode = lowPower ? "low_power" : "normal";
        return;
      }
      await api.setLowPowerMode(lowPower);
    },
    dispose() {
      this.unlisteners.forEach((fn) => fn());
      this.unlisteners = [];
    }
  }
});
