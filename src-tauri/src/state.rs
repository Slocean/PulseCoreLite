use std::sync::{
    atomic::{AtomicBool, AtomicU64},
    Arc,
};

use tokio::sync::{Mutex, RwLock};

use crate::{
    core::collectors::system_collector::SystemCollector,
    types::{AppSettings, HardwareInfo, TelemetrySnapshot},
};

pub struct AppState {
    pub settings: RwLock<AppSettings>,
    pub hardware_info: RwLock<HardwareInfo>,
    pub latest_snapshot: RwLock<TelemetrySnapshot>,
    pub collector: Mutex<SystemCollector>,
    pub refresh_rate_ms: AtomicU64,
    pub memory_trim_interval_ms: AtomicU64,
    pub memory_trim_enabled: AtomicBool,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub async fn initialize() -> anyhow::Result<SharedState> {
        let settings = AppSettings::default();
        let trim_interval_ms = settings.memory_trim_interval_minutes as u64 * 60 * 1000;
        let trim_enabled = settings.memory_trim_enabled;
        let collector = SystemCollector::new();
        let initial_snapshot = empty_snapshot();
        let hardware_info = empty_hardware_info();

        Ok(Arc::new(Self {
            settings: RwLock::new(settings),
            hardware_info: RwLock::new(hardware_info),
            latest_snapshot: RwLock::new(initial_snapshot),
            collector: Mutex::new(collector),
            refresh_rate_ms: AtomicU64::new(1000),
            memory_trim_interval_ms: AtomicU64::new(trim_interval_ms),
            memory_trim_enabled: AtomicBool::new(trim_enabled),
        }))
    }

    pub async fn record_snapshot(&self, snapshot: TelemetrySnapshot) {
        let mut lock = self.latest_snapshot.write().await;
        *lock = snapshot;
    }

    pub async fn collect_snapshot(&self, refresh_rate_ms: u64) -> TelemetrySnapshot {
        let mut collector = self.collector.lock().await;
        collector.collect(refresh_rate_ms)
    }
}

fn empty_snapshot() -> TelemetrySnapshot {
    TelemetrySnapshot {
        timestamp: chrono::Utc::now(),
        cpu: crate::types::CpuMetrics {
            usage_pct: 0.0,
            frequency_mhz: None,
            temperature_c: None,
        },
        gpu: crate::types::GpuMetrics {
            usage_pct: Some(0.0),
            temperature_c: None,
            memory_used_mb: None,
            memory_total_mb: None,
            frequency_mhz: None,
        },
        memory: crate::types::MemoryMetrics {
            used_mb: 0.0,
            total_mb: 1.0,
            usage_pct: 0.0,
        },
        disks: Vec::new(),
        network: crate::types::NetworkMetrics {
            download_bytes_per_sec: 0.0,
            upload_bytes_per_sec: 0.0,
            latency_ms: None,
        },
        app_cpu_usage_pct: Some(0.0),
        app_memory_mb: None,
        power_watts: None,
    }
}

fn empty_hardware_info() -> HardwareInfo {
    HardwareInfo {
        cpu_model: String::new(),
        cpu_max_freq_mhz: None,
        gpu_model: String::new(),
        ram_spec: String::new(),
        disk_models: Vec::new(),
        motherboard: String::new(),
        device_brand: String::new(),
    }
}
