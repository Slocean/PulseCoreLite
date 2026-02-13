use std::sync::{atomic::AtomicU64, Arc};

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
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub async fn initialize() -> anyhow::Result<SharedState> {
        let settings = AppSettings::default();
        let mut collector = SystemCollector::new();
        let initial_snapshot = empty_snapshot();
        let hardware_info = empty_hardware_info();

        Ok(Arc::new(Self {
            settings: RwLock::new(settings),
            hardware_info: RwLock::new(hardware_info),
            latest_snapshot: RwLock::new(initial_snapshot),
            collector: Mutex::new(collector),
            refresh_rate_ms: AtomicU64::new(1000),
        }))
    }

    pub async fn record_snapshot(&self, snapshot: TelemetrySnapshot) {
        let mut lock = self.latest_snapshot.write().await;
        *lock = snapshot;
    }

    pub async fn collect_snapshot(&self) -> TelemetrySnapshot {
        let mut collector = self.collector.lock().await;
        collector.collect()
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
            usage_pct: None,
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
