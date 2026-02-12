use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

use chrono::Utc;
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tokio::{select, sync::oneshot};
use tracing::{error, warn};
use uuid::Uuid;

use crate::{
    core::network_test::ping,
    state::SharedState,
    types::{
        AppBootstrap, AppSettings, ExportResult, HistoryFilter, HistoryPage, Mode, PingResult,
        SettingsPatch, SpeedTestConfig, SpeedTestProgress, SpeedTestResult, TimeRange,
        WarningEvent,
    },
};

type CmdResult<T> = Result<T, String>;

#[derive(Clone, serde::Serialize)]
struct ModeChangedPayload {
    mode: &'static str,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn emit_warning(app: &AppHandle, message: String, source: &str) {
    let payload = WarningEvent {
        message,
        source: source.to_string(),
    };
    if let Err(e) = app.emit("system://warning", payload) {
        warn!("failed to emit warning: {e}");
    }
}

#[tauri::command]
pub async fn get_initial_state(state: State<'_, SharedState>) -> CmdResult<AppBootstrap> {
    Ok(AppBootstrap {
        settings: state.settings.read().await.clone(),
        hardware_info: state.hardware_info.clone(),
        latest_snapshot: state.latest_snapshot.read().await.clone(),
    })
}

#[tauri::command]
pub async fn get_hardware_info(
    state: State<'_, SharedState>,
) -> CmdResult<crate::types::HardwareInfo> {
    Ok(state.hardware_info.clone())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, SharedState>) -> CmdResult<AppSettings> {
    Ok(state.settings.read().await.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, SharedState>,
    patch: SettingsPatch,
) -> CmdResult<AppSettings> {
    let updated = {
        let mut settings = state.settings.write().await;
        settings.apply_patch(patch);
        settings.clone()
    };

    state.db.save_settings(&updated).await.map_err(err)?;
    state.prune_history().await.map_err(err)?;
    Ok(updated)
}

#[tauri::command]
pub async fn start_speed_test(
    app: AppHandle,
    state: State<'_, SharedState>,
    config: SpeedTestConfig,
) -> CmdResult<String> {
    let endpoint = config.endpoint.trim().to_string();
    if endpoint.is_empty() {
        return Err("endpoint must not be empty".to_string());
    }

    {
        let running = state.speed_test_cancel.lock().await;
        if !running.is_empty() {
            return Err("another speed test is already running".to_string());
        }
    }

    let task_id = Uuid::new_v4().to_string();
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    {
        let mut lock = state.speed_test_cancel.lock().await;
        lock.insert(task_id.clone(), cancel_tx);
    }

    let app_clone = app.clone();
    let state_clone = state.inner().clone();
    let max_seconds = config.max_seconds.clamp(2, 30);
    let task_id_clone = task_id.clone();

    tauri::async_runtime::spawn(async move {
        let started = Instant::now();
        let started_at = Utc::now();

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(max_seconds + 2))
            .build()
        {
            Ok(client) => client,
            Err(e) => {
                emit_warning(&app_clone, e.to_string(), "speedtest_client");
                let mut lock = state_clone.speed_test_cancel.lock().await;
                lock.remove(&task_id_clone);
                return;
            }
        };

        let mut response = None;
        for attempt in 1..=2 {
            match client.get(&endpoint).send().await {
                Ok(resp) if resp.status().is_success() => {
                    response = Some(resp);
                    break;
                }
                Ok(resp) => {
                    let status = resp.status();
                    if attempt == 2 {
                        emit_warning(
                            &app_clone,
                            format!("speed test request failed with status {status}"),
                            "speedtest_http",
                        );
                    } else {
                        tokio::time::sleep(Duration::from_millis(350)).await;
                    }
                }
                Err(e) => {
                    if attempt == 2 {
                        emit_warning(&app_clone, e.to_string(), "speedtest_http");
                    } else {
                        tokio::time::sleep(Duration::from_millis(350)).await;
                    }
                }
            }
        }

        let Some(response) = response else {
            let mut lock = state_clone.speed_test_cancel.lock().await;
            lock.remove(&task_id_clone);
            return;
        };

        let mut stream = response.bytes_stream();
        let mut downloaded = 0_u64;

        loop {
            if started.elapsed().as_secs() >= max_seconds {
                break;
            }

            select! {
                _ = &mut cancel_rx => {
                    break;
                }
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            downloaded = downloaded.saturating_add(bytes.len() as u64);
                            let elapsed_ms = started.elapsed().as_millis() as u64;
                            let elapsed_s = (elapsed_ms as f64 / 1000.0).max(0.001);
                            let mbps = downloaded as f64 * 8.0 / elapsed_s / 1_000_000.0;
                            let payload = SpeedTestProgress {
                                task_id: task_id_clone.clone(),
                                downloaded_bytes: downloaded,
                                elapsed_ms,
                                download_mbps: mbps,
                            };
                            if let Err(e) = app_clone.emit("network://speedtest_progress", payload) {
                                warn!("failed to emit speedtest progress: {e}");
                            }
                        }
                        Some(Err(e)) => {
                            emit_warning(&app_clone, e.to_string(), "speedtest_stream");
                            break;
                        }
                        None => {
                            break;
                        }
                    }
                }
            }
        }

        let elapsed_ms = started.elapsed().as_millis() as i64;
        let elapsed_s = (elapsed_ms as f64 / 1000.0).max(0.001);
        let download_mbps = downloaded as f64 * 8.0 / elapsed_s / 1_000_000.0;

        let result = SpeedTestResult {
            task_id: task_id_clone.clone(),
            endpoint,
            download_mbps,
            upload_mbps: None,
            latency_ms: None,
            jitter_ms: None,
            loss_pct: None,
            started_at,
            duration_ms: elapsed_ms,
        };

        if let Err(e) = state_clone.push_speed_result(&result).await {
            emit_warning(&app_clone, e.to_string(), "db");
        }

        if let Err(e) = app_clone.emit("network://speedtest_done", result) {
            warn!("failed to emit speedtest_done: {e}");
        }

        let mut lock = state_clone.speed_test_cancel.lock().await;
        lock.remove(&task_id_clone);
    });

    Ok(task_id)
}

#[tauri::command]
pub async fn cancel_speed_test(
    state: State<'_, SharedState>,
    task_id: String,
) -> CmdResult<bool> {
    let mut map = state.speed_test_cancel.lock().await;
    if let Some(tx) = map.remove(&task_id) {
        let _ = tx.send(());
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn run_ping_test(
    app: AppHandle,
    _state: State<'_, SharedState>,
    target: String,
    count: u32,
) -> CmdResult<PingResult> {
    let result = ping::run_ping(&target, count).await.map_err(err)?;
    if let Err(e) = app.emit("network://ping_done", result.clone()) {
        warn!("failed to emit ping_done: {e}");
    }
    Ok(result)
}

#[tauri::command]
pub async fn query_history(
    state: State<'_, SharedState>,
    filter: HistoryFilter,
) -> CmdResult<HistoryPage> {
    state.db.query_history(&filter).await.map_err(err)
}

#[tauri::command]
pub async fn export_history_csv(
    state: State<'_, SharedState>,
    range: TimeRange,
) -> CmdResult<ExportResult> {
    let filename = format!("history-{}.csv", Utc::now().format("%Y%m%d-%H%M%S"));
    let target: PathBuf = state.export_dir.join(filename);
    state.db.export_history_csv(&target, &range).await.map_err(err)
}

#[tauri::command]
pub async fn toggle_overlay(app: AppHandle, visible: bool) -> CmdResult<bool> {
    let win = if let Some(window) = app.get_webview_window("overlay") {
        window
    } else {
        WebviewWindowBuilder::new(&app, "overlay", WebviewUrl::App("index.html#/overlay".into()))
            .title("PulseCore Overlay")
            .always_on_top(true)
            .resizable(false)
            .maximizable(false)
            .decorations(false)
            .transparent(true)
            .inner_size(340.0, 260.0)
            .skip_taskbar(true)
            .build()
            .map_err(err)?
    };

    if visible {
        win.show().map_err(err)?;
        win.set_focus().map_err(err)?;
    } else {
        win.hide().map_err(err)?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn set_low_power_mode(
    app: AppHandle,
    state: State<'_, SharedState>,
    low_power: bool,
) -> CmdResult<bool> {
    let mode = if low_power {
        Mode::LowPower
    } else {
        Mode::Normal
    };
    state.set_mode(mode).await;

    if let Err(e) = app.emit(
        "telemetry://mode_changed",
        ModeChangedPayload {
            mode: mode.as_str(),
        },
    ) {
        error!("failed to emit mode change: {e}");
    }

    Ok(true)
}


