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
  frequency_mhz: number | null;
}

export interface MemoryMetrics {
  used_mb: number;
  total_mb: number;
  usage_pct: number;
}

export interface DiskMetrics {
  name: string;
  label: string;
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
  disks: DiskMetrics[];
  network: NetworkMetrics;
  power_watts: number | null;
}

export interface HardwareInfo {
  cpu_model: string;
  cpu_max_freq_mhz: number | null;
  gpu_model: string;
  ram_spec: string;
  disk_models: string[];
  motherboard: string;
  device_brand: string;
}

export interface AppSettings {
  language: "zh-CN" | "en-US";
  closeToTray: boolean;
}

export interface AppBootstrap {
  settings: AppSettings;
  hardware_info: HardwareInfo;
  latest_snapshot: TelemetrySnapshot;
}
