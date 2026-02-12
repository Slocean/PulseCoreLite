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
pub struct ModuleToggles {
    pub show_cpu: bool,
    pub show_gpu: bool,
    pub show_memory: bool,
    pub show_disk: bool,
    pub show_network: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayDisplaySettings {
    pub show_values: bool,
    pub show_percent: bool,
    pub show_hardware_info: bool,
}

impl Default for OverlayDisplaySettings {
    fn default() -> Self {
        Self {
            show_values: true,
            show_percent: true,
            show_hardware_info: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub refresh_rate_ms: u64,
    pub low_power_rate_ms: u64,
    pub module_toggles: ModuleToggles,
    pub theme: String,
    pub accent: String,
    pub glass_opacity: f64,
    pub glow_intensity: f64,
    pub language: String,
    pub speedtest_endpoints: Vec<String>,
    pub history_retention_days: i64,
    pub sensor_boost_enabled: bool,
    #[serde(default)]
    pub overlay_display: OverlayDisplaySettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            refresh_rate_ms: 500,
            low_power_rate_ms: 2000,
            module_toggles: ModuleToggles {
                show_cpu: true,
                show_gpu: true,
                show_memory: true,
                show_disk: true,
                show_network: true,
            },
            theme: "cyber-dark".to_string(),
            accent: "#2b6cee".to_string(),
            glass_opacity: 0.75,
            glow_intensity: 0.4,
            language: "zh-CN".to_string(),
            speedtest_endpoints: vec![
                "https://speed.hetzner.de/100MB.bin".to_string(),
                "https://proof.ovh.net/files/100Mb.dat".to_string(),
            ],
            history_retention_days: 30,
            sensor_boost_enabled: false,
            overlay_display: OverlayDisplaySettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SettingsPatch {
    pub refresh_rate_ms: Option<u64>,
    pub low_power_rate_ms: Option<u64>,
    pub module_toggles: Option<ModuleTogglesPatch>,
    pub theme: Option<String>,
    pub accent: Option<String>,
    pub glass_opacity: Option<f64>,
    pub glow_intensity: Option<f64>,
    pub language: Option<String>,
    pub speedtest_endpoints: Option<Vec<String>>,
    pub history_retention_days: Option<i64>,
    pub sensor_boost_enabled: Option<bool>,
    pub overlay_display: Option<OverlayDisplaySettingsPatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModuleTogglesPatch {
    pub show_cpu: Option<bool>,
    pub show_gpu: Option<bool>,
    pub show_memory: Option<bool>,
    pub show_disk: Option<bool>,
    pub show_network: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OverlayDisplaySettingsPatch {
    pub show_values: Option<bool>,
    pub show_percent: Option<bool>,
    pub show_hardware_info: Option<bool>,
}

impl AppSettings {
    pub fn apply_patch(&mut self, patch: SettingsPatch) {
        if let Some(v) = patch.refresh_rate_ms {
            self.refresh_rate_ms = v.clamp(250, 5000);
        }
        if let Some(v) = patch.low_power_rate_ms {
            self.low_power_rate_ms = v.clamp(500, 10000);
        }
        if let Some(v) = patch.theme {
            self.theme = v;
        }
        if let Some(v) = patch.accent {
            self.accent = v;
        }
        if let Some(v) = patch.glass_opacity {
            self.glass_opacity = v.clamp(0.2, 1.0);
        }
        if let Some(v) = patch.glow_intensity {
            self.glow_intensity = v.clamp(0.0, 1.0);
        }
        if let Some(v) = patch.language {
            self.language = v;
        }
        if let Some(v) = patch.speedtest_endpoints {
            if !v.is_empty() {
                self.speedtest_endpoints = v;
            }
        }
        if let Some(v) = patch.history_retention_days {
            self.history_retention_days = v.clamp(1, 365);
        }
        if let Some(v) = patch.sensor_boost_enabled {
            self.sensor_boost_enabled = v;
        }

        if let Some(display) = patch.overlay_display {
            if let Some(v) = display.show_values {
                self.overlay_display.show_values = v;
            }
            if let Some(v) = display.show_percent {
                self.overlay_display.show_percent = v;
            }
            if let Some(v) = display.show_hardware_info {
                self.overlay_display.show_hardware_info = v;
            }
        }

        if let Some(mt) = patch.module_toggles {
            if let Some(v) = mt.show_cpu {
                self.module_toggles.show_cpu = v;
            }
            if let Some(v) = mt.show_gpu {
                self.module_toggles.show_gpu = v;
            }
            if let Some(v) = mt.show_memory {
                self.module_toggles.show_memory = v;
            }
            if let Some(v) = mt.show_disk {
                self.module_toggles.show_disk = v;
            }
            if let Some(v) = mt.show_network {
                self.module_toggles.show_network = v;
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestConfig {
    pub endpoint: String,
    pub max_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestProgress {
    pub task_id: String,
    pub downloaded_bytes: u64,
    pub elapsed_ms: u64,
    pub download_mbps: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    pub task_id: String,
    pub endpoint: String,
    pub download_mbps: f64,
    pub upload_mbps: Option<f64>,
    pub latency_ms: Option<f64>,
    pub jitter_ms: Option<f64>,
    pub loss_pct: Option<f64>,
    pub started_at: DateTime<Utc>,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResult {
    pub target: String,
    pub min_ms: Option<f64>,
    pub max_ms: Option<f64>,
    pub avg_ms: Option<f64>,
    pub jitter_ms: Option<f64>,
    pub loss_pct: Option<f64>,
    pub samples: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryFilter {
    pub page: u32,
    pub page_size: u32,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryPage {
    pub total: i64,
    pub items: Vec<SpeedTestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub path: String,
    pub rows: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarningEvent {
    pub message: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppBootstrap {
    pub settings: AppSettings,
    pub hardware_info: HardwareInfo,
    pub latest_snapshot: TelemetrySnapshot,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Normal,
    LowPower,
}

impl Mode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Mode::Normal => "normal",
            Mode::LowPower => "low_power",
        }
    }
}
