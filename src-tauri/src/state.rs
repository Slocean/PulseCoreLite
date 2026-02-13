use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};

use crate::{
    core::{collectors::system_collector::SystemCollector, device_info},
    types::{AppSettings, HardwareInfo, TelemetrySnapshot},
};

pub struct AppState {
    pub settings: RwLock<AppSettings>,
    pub hardware_info: HardwareInfo,
    pub latest_snapshot: RwLock<TelemetrySnapshot>,
    pub collector: Mutex<SystemCollector>,
}

pub type SharedState = Arc<AppState>;

impl AppState {
    pub async fn initialize() -> anyhow::Result<SharedState> {
        let settings = AppSettings::default();
        let mut collector = SystemCollector::new();
        let initial_snapshot = collector.collect();
        let hardware_info = device_info::collect_hardware_info();

        Ok(Arc::new(Self {
            settings: RwLock::new(settings),
            hardware_info,
            latest_snapshot: RwLock::new(initial_snapshot),
            collector: Mutex::new(collector),
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
