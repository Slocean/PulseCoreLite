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
  appCpuUsagePct: number | null;
  appMemoryMb: number | null;
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
  language: 'zh-CN' | 'en-US';
  closeToTray: boolean;
  autoStartEnabled: boolean;
  memoryTrimEnabled: boolean;
  memoryTrimSystemEnabled: boolean;
  memoryTrimTargets: Array<'app' | 'system'>;
  memoryTrimIntervalMinutes: number;
  rememberOverlayPosition: boolean;
  overlayAlwaysOnTop: boolean;
  taskbarMonitorEnabled: boolean;
  taskbarAlwaysOnTop: boolean;
  taskbarAutoHideOnFullscreen: boolean;
  taskbarPositionLocked: boolean;
  factoryResetHotkey: string | null;
}

export interface AppBootstrap {
  settings: AppSettings;
  hardware_info: HardwareInfo;
  latest_snapshot: TelemetrySnapshot;
}

export interface TaskbarInfo {
  edge: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type ShutdownMode = 'countdown' | 'once' | 'daily' | 'weekly' | 'monthly';

export interface ShutdownPlan {
  mode: ShutdownMode;
  createdAt: string;
  executeAt: string | null;
  countdownSeconds: number | null;
  time: string | null;
  weekday: number | null;
  dayOfMonth: number | null;
}

export interface ScheduleShutdownRequest {
  mode: ShutdownMode;
  delaySeconds?: number;
  executeAt?: string;
  time?: string;
  weekday?: number;
  dayOfMonth?: number;
}

export interface ProfileStatus {
  active: boolean;
  path: string | null;
  startedAt: string | null;
  samples: number;
}

export type ReminderChannel = 'email' | 'fullscreen';
export type ReminderContentType = 'text' | 'markdown' | 'web' | 'image';

export interface WeeklyReminderSlot {
  weekday: number;
  time: string;
}

export interface MonthlyReminderSlot {
  day: number;
  time: string;
}

export interface TaskReminder {
  id: string;
  enabled: boolean;
  title: string;
  channel: ReminderChannel;
  email: string;
  dailyTimes: string[];
  weeklySlots: WeeklyReminderSlot[];
  monthlySlots: MonthlyReminderSlot[];
  contentType: ReminderContentType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpEmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  security: 'none' | 'starttls' | 'tls';
}

export interface SendReminderEmailRequest {
  smtp: SmtpEmailConfig;
  to: string;
  subject: string;
  body: string;
}
