use std::{path::PathBuf, time::Duration};

use anyhow::Context;

use tauri::{AppHandle, Emitter, Manager};

use crate::{
    ipc::commands,
    state::SharedState,
    types::{AppSettings, Mode, WarningEvent},
};

pub fn start_telemetry_loop(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        let mut tick_count: u64 = 0;
        let mut consecutive_failures: u32 = 0;

        loop {
            let snapshot = match tokio::time::timeout(Duration::from_secs(3), state.collect_snapshot()).await {
                Ok(data) => {
                    consecutive_failures = 0;
                    data
                }
                Err(_) => {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                    let warning = WarningEvent {
                        message: format!(
                            "Telemetry collection timeout (attempt #{consecutive_failures}), using last snapshot"
                        ),
                        source: "collector_timeout".to_string(),
                    };
                    let _ = app.emit("system://warning", warning);

                    if consecutive_failures >= 3 {
                        state.reset_collector().await;
                        let _ = app.emit(
                            "system://warning",
                            WarningEvent {
                                message: "Collector was reinitialized after repeated failures".to_string(),
                                source: "collector_recover".to_string(),
                            },
                        );
                        consecutive_failures = 0;
                    }

                    state.latest_snapshot.read().await.clone()
                }
            };

            state.record_snapshot(snapshot.clone()).await;

            if let Err(e) = app.emit("telemetry://snapshot", snapshot.clone()) {
                tracing::warn!("failed to emit telemetry snapshot: {e}");
            }

            if let Some(win) = app.get_webview_window("main") {
                let title = format!(
                    "PulseCore · CPU {:.0}% · RAM {:.0}% · Down {:.1} MB/s",
                    snapshot.cpu.usage_pct,
                    snapshot.memory.usage_pct,
                    snapshot.network.download_bytes_per_sec / 1024.0 / 1024.0
                );
                let _ = win.set_title(&title);
            }

            tick_count = tick_count.saturating_add(1);
            if tick_count % 180 == 0 {
                if let Err(e) = state.prune_history().await {
                    let _ = app.emit(
                        "system://warning",
                        WarningEvent {
                            message: e.to_string(),
                            source: "history_prune".to_string(),
                        },
                    );
                }
            }

            let mode = *state.mode.read().await;
            let settings: AppSettings = state.settings.read().await.clone();
            let interval_ms = match mode {
                Mode::Normal => settings.refresh_rate_ms,
                Mode::LowPower => settings.low_power_rate_ms,
            }
            .clamp(100, 10_000);

            tokio::time::sleep(Duration::from_millis(interval_ms)).await;
        }
    });
}

pub fn app_data_paths(app: &tauri::App) -> anyhow::Result<(PathBuf, PathBuf)> {
    let app_data = app.path().app_data_dir().context("failed to resolve app data dir")?;
    Ok((app_data.join("pulsecore.db"), app_data.join("exports")))
}

pub fn register_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![
        commands::get_initial_state,
        commands::get_hardware_info,
        commands::get_settings,
        commands::update_settings,
        commands::start_speed_test,
        commands::cancel_speed_test,
        commands::run_ping_test,
        commands::query_history,
        commands::export_history_csv,
        commands::toggle_overlay,
        commands::set_low_power_mode
    ])
}
