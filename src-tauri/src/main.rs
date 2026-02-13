mod app;
mod core;
mod db;
mod ipc;
mod state;
mod types;

use crate::state::AppState;
use tauri::Manager;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "pulsecore=info,tauri=info".to_string()),
        )
        .init();

    let builder = tauri::Builder::default().setup(|app| {
        let (db_path, export_dir) =
            crate::app::app_data_paths(app).expect("failed to resolve app data paths");
        let state = tauri::async_runtime::block_on(AppState::initialize(db_path, export_dir))
            .expect("failed to initialize PulseCore state");

        app.manage(state.clone());
        crate::app::start_telemetry_loop(app.handle().clone(), state);

        Ok(())
    });

    crate::app::register_invoke_handler(builder)
        .run(tauri::generate_context!())
        .expect("error while running PulseCore");
}


