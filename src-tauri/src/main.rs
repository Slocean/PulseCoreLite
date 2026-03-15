#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod core;
mod ipc;
mod local_ai;
mod native_taskbar;
mod profiler;
mod state;
mod types;

use crate::state::AppState;
use tauri::{Manager, RunEvent};

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "pulsecorelite=info,tauri=info".to_string()),
        )
        .init();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = tauri::async_runtime::block_on(AppState::initialize())
                .expect("failed to initialize PulseCoreLite state");

            app.manage(state.clone());
            crate::app::start_telemetry_loop(app.handle().clone(), state.clone());
            crate::app::start_memory_trim_loop(state.clone());
            crate::app::start_task_reminder_loop(app.handle().clone(), state);

            #[cfg(desktop)]
            {
                if let Err(err) = app
                    .handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())
                {
                    tracing::warn!("Failed to initialize updater plugin: {err}");
                }
            }

            Ok(())
        });

    let app = crate::app::register_invoke_handler(builder)
        .build(tauri::generate_context!())
        .expect("error while building PulseCoreLite");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            if let Some(state) = app_handle.try_state::<crate::state::SharedState>() {
                tauri::async_runtime::block_on(crate::local_ai::shutdown_local_ai_runtime(
                    state.inner().clone(),
                ));
            }
        }
    });
}
