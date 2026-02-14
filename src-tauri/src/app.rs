use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::{ipc::commands, state::SharedState};

pub fn start_telemetry_loop(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        loop {
            let snapshot = match tokio::time::timeout(Duration::from_secs(3), state.collect_snapshot()).await {
                Ok(data) => data,
                Err(_) => state.latest_snapshot.read().await.clone(),
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

            let rate = state.refresh_rate_ms.load(std::sync::atomic::Ordering::Relaxed);
            tokio::time::sleep(Duration::from_millis(rate)).await;
        }
    });
}

pub fn register_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![
        commands::get_initial_state,
        commands::get_hardware_info,
        commands::get_taskbar_info,
        commands::get_auto_start_enabled,
        commands::set_auto_start_enabled,
        commands::toggle_overlay,
        commands::set_refresh_rate,
        commands::confirm_factory_reset,
        commands::exit_app
    ])
}
