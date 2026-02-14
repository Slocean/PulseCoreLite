#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod core;
mod ipc;
mod state;
mod types;

use crate::state::AppState;
use tauri::Manager;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "pulsecorelite=info,tauri=info".to_string()),
        )
        .init();

    let builder = tauri::Builder::default().setup(|app| {
        let state = tauri::async_runtime::block_on(AppState::initialize())
            .expect("failed to initialize PulseCoreLite state");

        app.manage(state.clone());
        crate::app::start_telemetry_loop(app.handle().clone(), state);

        Ok(())
    });

    crate::app::register_invoke_handler(builder)
        .run(tauri::generate_context!())
        .expect("error while running PulseCoreLite");
}


