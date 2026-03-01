use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub usage_pct: f64,
    pub frequency_mhz: Option<u64>,
    pub temperature_c: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuMetrics {
    pub usage_pct: Option<f64>,
    pub temperature_c: Option<f64>,
    pub memory_used_mb: Option<f64>,
    pub memory_total_mb: Option<f64>,
    pub frequency_mhz: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub used_mb: f64,
    pub total_mb: f64,
    pub usage_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub name: String,
    pub label: String,
    pub used_gb: f64,
    pub total_gb: f64,
    pub usage_pct: f64,
    pub read_bytes_per_sec: Option<f64>,
    pub write_bytes_per_sec: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub download_bytes_per_sec: f64,
    pub upload_bytes_per_sec: f64,
    pub latency_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub timestamp: DateTime<Utc>,
    pub cpu: CpuMetrics,
    pub gpu: GpuMetrics,
    pub memory: MemoryMetrics,
    pub disks: Vec<DiskMetrics>,
    pub network: NetworkMetrics,
    #[serde(rename = "appCpuUsagePct")]
    pub app_cpu_usage_pct: Option<f64>,
    #[serde(rename = "appMemoryMb")]
    pub app_memory_mb: Option<f64>,
    pub power_watts: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub cpu_model: String,
    pub cpu_max_freq_mhz: Option<u64>,
    pub gpu_model: String,
    pub ram_spec: String,
    pub disk_models: Vec<String>,
    pub motherboard: String,
    pub device_brand: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String,
    #[serde(rename = "closeToTray")]
    pub close_to_tray: bool,
    #[serde(rename = "autoStartEnabled")]
    pub auto_start_enabled: bool,
    #[serde(rename = "memoryTrimIntervalMinutes")]
    pub memory_trim_interval_minutes: u8,
    #[serde(rename = "rememberOverlayPosition")]
    pub remember_overlay_position: bool,
    #[serde(rename = "overlayAlwaysOnTop")]
    pub overlay_always_on_top: bool,
    #[serde(rename = "taskbarMonitorEnabled")]
    pub taskbar_monitor_enabled: bool,
    #[serde(rename = "taskbarAlwaysOnTop")]
    pub taskbar_always_on_top: bool,
    #[serde(rename = "taskbarAutoHideOnFullscreen")]
    pub taskbar_auto_hide_on_fullscreen: bool,
    #[serde(rename = "taskbarPositionLocked")]
    pub taskbar_position_locked: bool,
    #[serde(rename = "factoryResetHotkey")]
    pub factory_reset_hotkey: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "zh-CN".to_string(),
            close_to_tray: false,
            auto_start_enabled: false,
            memory_trim_interval_minutes: 5,
            remember_overlay_position: true,
            overlay_always_on_top: true,
            taskbar_monitor_enabled: false,
            taskbar_always_on_top: true,
            taskbar_auto_hide_on_fullscreen: false,
            taskbar_position_locked: false,
            factory_reset_hotkey: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppBootstrap {
    pub settings: AppSettings,
    pub hardware_info: HardwareInfo,
    pub latest_snapshot: TelemetrySnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskbarInfo {
    /// `ABE_LEFT`=0, `ABE_TOP`=1, `ABE_RIGHT`=2, `ABE_BOTTOM`=3.
    pub edge: u32,
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShutdownPlan {
    /// countdown | once | daily | weekly | monthly
    pub mode: String,
    pub created_at: DateTime<Utc>,
    pub execute_at: Option<DateTime<Utc>>,
    pub countdown_seconds: Option<u64>,
    /// HH:mm format for repeat plans.
    pub time: Option<String>,
    /// 1=Monday ... 7=Sunday
    pub weekday: Option<u8>,
    /// 1..31
    pub day_of_month: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleShutdownRequest {
    /// countdown | once | daily | weekly | monthly
    pub mode: String,
    pub delay_seconds: Option<u64>,
    pub execute_at: Option<DateTime<Utc>>,
    /// HH:mm format for repeat plans.
    pub time: Option<String>,
    /// 1=Monday ... 7=Sunday
    pub weekday: Option<u8>,
    /// 1..31
    pub day_of_month: Option<u8>,
}
