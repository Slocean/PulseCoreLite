export type Mode = "normal" | "low_power";

export interface CpuMetrics {
  usage_pct: number;
  frequency_mhz: number | null;
  temperature_c: number | null;
}

export interface GpuMetrics {
  usage_pct: number | null;
  temperature_c: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
}

export interface MemoryMetrics {
  used_mb: number;
  total_mb: number;
  usage_pct: number;
}

export interface DiskMetrics {
  used_gb: number;
  total_gb: number;
  usage_pct: number;
  read_bytes_per_sec: number | null;
  write_bytes_per_sec: number | null;
}

export interface NetworkMetrics {
  download_bytes_per_sec: number;
  upload_bytes_per_sec: number;
  latency_ms: number | null;
}

export interface TelemetrySnapshot {
  timestamp: string;
  cpu: CpuMetrics;
  gpu: GpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  power_watts: number | null;
}

export interface HardwareInfo {
  cpu_model: string;
  gpu_model: string;
  ram_spec: string;
  disk_models: string[];
  motherboard: string;
  device_brand: string;
}

export interface ModuleToggles {
  show_cpu: boolean;
  show_gpu: boolean;
  show_memory: boolean;
  show_disk: boolean;
  show_network: boolean;
}

export interface AppSettings {
  refresh_rate_ms: number;
  low_power_rate_ms: number;
  module_toggles: ModuleToggles;
  theme: "cyber-dark";
  accent: string;
  glass_opacity: number;
  glow_intensity: number;
  language: "zh-CN" | "en-US";
  speedtest_endpoints: string[];
  history_retention_days: number;
  sensor_boost_enabled: boolean;
}

export interface SettingsPatch {
  refresh_rate_ms?: number;
  low_power_rate_ms?: number;
  module_toggles?: Partial<ModuleToggles>;
  theme?: "cyber-dark";
  accent?: string;
  glass_opacity?: number;
  glow_intensity?: number;
  language?: "zh-CN" | "en-US";
  speedtest_endpoints?: string[];
  history_retention_days?: number;
  sensor_boost_enabled?: boolean;
}

export interface SpeedTestConfig {
  endpoint: string;
  max_seconds: number;
}

export interface SpeedTestProgress {
  task_id: string;
  downloaded_bytes: number;
  elapsed_ms: number;
  download_mbps: number;
}

export interface SpeedTestResult {
  task_id: string;
  endpoint: string;
  download_mbps: number;
  upload_mbps: number | null;
  latency_ms: number | null;
  jitter_ms: number | null;
  loss_pct: number | null;
  started_at: string;
  duration_ms: number;
}

export interface PingResult {
  target: string;
  min_ms: number | null;
  max_ms: number | null;
  avg_ms: number | null;
  jitter_ms: number | null;
  loss_pct: number | null;
  samples: number[];
}

export interface HistoryFilter {
  page: number;
  page_size: number;
  from?: string;
  to?: string;
}

export interface HistoryPage {
  total: number;
  items: SpeedTestResult[];
}

export interface TimeRange {
  from?: string;
  to?: string;
}

export interface ExportResult {
  path: string;
  rows: number;
}

export interface WarningEvent {
  message: string;
  source: string;
}

export interface AppBootstrap {
  settings: AppSettings;
  hardware_info: HardwareInfo;
  latest_snapshot: TelemetrySnapshot;
}
