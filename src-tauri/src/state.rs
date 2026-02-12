use std::{collections::HashMap, path::PathBuf, sync::Arc};

use chrono::Utc;
use tokio::sync::{Mutex, RwLock};

use crate::{
    core::{collectors::system_collector::SystemCollector, device_info},
    db::Database,
    types::{AppSettings, HardwareInfo, Mode, SpeedTestResult, TelemetrySnapshot},
};

pub struct AppState {
    pub db: Database,
    pub settings: RwLock<AppSettings>,
    pub hardware_info: HardwareInfo,
    pub latest_snapshot: RwLock<TelemetrySnapshot>,
    pub mode: RwLock<Mode>,
    pub collector: Mutex<SystemCollector>,
    pub speed_test_cancel: Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>,
    pub export_dir: PathBuf,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub async fn initialize(db_path: PathBuf, export_dir: PathBuf) -> anyhow::Result<SharedState> {
        let db = Database::new(&db_path).await?;
        let settings = db.load_settings().await?.unwrap_or_default();
        db.save_settings(&settings).await?;

        let mut collector = SystemCollector::new();
        let initial_snapshot = collector.collect();
        let hardware_info = device_info::collect_hardware_info();

        Ok(Arc::new(Self {
            db,
            settings: RwLock::new(settings),
            hardware_info,
            latest_snapshot: RwLock::new(initial_snapshot),
            mode: RwLock::new(Mode::Normal),
            collector: Mutex::new(collector),
            speed_test_cancel: Mutex::new(HashMap::new()),
            export_dir,
        }))
    }

    pub async fn push_speed_result(&self, result: &SpeedTestResult) -> anyhow::Result<()> {
        self.db.insert_speed_test(result).await
    }

    pub async fn prune_history(&self) -> anyhow::Result<()> {
        let keep = self.settings.read().await.history_retention_days;
        self.db.prune_old_history(keep).await
    }

    pub async fn set_mode(&self, mode: Mode) {
        let mut lock = self.mode.write().await;
        *lock = mode;
    }

    pub async fn record_snapshot(&self, snapshot: TelemetrySnapshot) {
        let mut lock = self.latest_snapshot.write().await;
        *lock = snapshot;
    }

    pub async fn collect_snapshot(&self) -> TelemetrySnapshot {
        let mut collector = self.collector.lock().await;
        collector.collect()
    }

    pub async fn reset_collector(&self) {
        let mut collector = self.collector.lock().await;
        *collector = SystemCollector::new();
    }

    pub fn fallback_snapshot() -> TelemetrySnapshot {
        TelemetrySnapshot {
            timestamp: Utc::now(),
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
}
