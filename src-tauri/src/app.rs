use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::{ipc::commands, state::SharedState};

pub fn start_telemetry_loop(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        loop {
            let visible_labels = visible_consumer_labels(&app);
            let has_visible_consumer = !visible_labels.is_empty();
            let refresh_rate = state
                .refresh_rate_ms
                .load(std::sync::atomic::Ordering::Relaxed)
                .max(10);
            let snapshot = state.collect_snapshot(refresh_rate).await;

            state.record_snapshot(snapshot.clone()).await;

            if has_visible_consumer {
                for label in &visible_labels {
                    if let Err(e) = app.emit_to(*label, "telemetry://snapshot", snapshot.clone()) {
                        tracing::warn!("failed to emit telemetry snapshot to {label}: {e}");
                    }
                }
            }

            if visible_labels.iter().any(|label| *label == "main") {
                if let Some(win) = app.get_webview_window("main") {
                    let title = format!(
                        "PulseCore | CPU {:.0}% | RAM {:.0}% | Down {:.1} MB/s",
                        snapshot.cpu.usage_pct,
                        snapshot.memory.usage_pct,
                        snapshot.network.download_bytes_per_sec / 1024.0 / 1024.0
                    );
                    let _ = win.set_title(&title);
                }
            }

            tokio::time::sleep(Duration::from_millis(refresh_rate)).await;
        }
    });
}

fn visible_consumer_labels(app: &AppHandle) -> Vec<&'static str> {
    let mut labels = Vec::with_capacity(3);
    for label in ["main", "taskbar", "toolkit"] {
        if let Some(win) = app.get_webview_window(label) {
            if win.is_visible().unwrap_or(false) {
                labels.push(label);
            }
        }
    }
    labels
}

pub fn register_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![
        commands::get_initial_state,
        commands::get_hardware_info,
        commands::get_taskbar_info,
        commands::set_window_system_topmost,
        commands::get_auto_start_enabled,
        commands::set_auto_start_enabled,
        commands::get_installation_mode,
        commands::uninstall_app,
        commands::toggle_overlay,
        commands::set_refresh_rate,
        commands::save_export_config,
        commands::confirm_factory_reset,
        commands::get_shutdown_plan,
        commands::schedule_shutdown,
        commands::cancel_shutdown_schedule,
        commands::exit_app
    ])
}
