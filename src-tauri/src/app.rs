use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::{ipc::commands, state::SharedState};

pub fn start_telemetry_loop(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        let mut current_rate = state
            .refresh_rate_ms
            .load(std::sync::atomic::Ordering::Relaxed)
            .max(10);
        let mut ticker = tokio::time::interval(Duration::from_millis(current_rate));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            let configured_rate = state
                .refresh_rate_ms
                .load(std::sync::atomic::Ordering::Relaxed)
                .max(10);
            if configured_rate != current_rate {
                current_rate = configured_rate;
                ticker = tokio::time::interval(Duration::from_millis(current_rate));
                ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            }
            ticker.tick().await;

            let visible_labels = visible_consumer_labels(&app);
            let has_visible_consumer = !visible_labels.is_empty();
            let snapshot = state.collect_snapshot(current_rate).await;

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

        }
    });
}

pub fn start_memory_trim_loop(state: SharedState) {
    const MIN_INTERVAL_MS: u64 = 60_000;
    const MAX_INTERVAL_MS: u64 = 30 * 60 * 1000;

    tauri::async_runtime::spawn(async move {
        let mut current_interval_ms = state
            .memory_trim_interval_ms
            .load(std::sync::atomic::Ordering::Relaxed)
            .clamp(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
        let mut ticker = tokio::time::interval(Duration::from_millis(current_interval_ms));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            let configured = state
                .memory_trim_interval_ms
                .load(std::sync::atomic::Ordering::Relaxed)
                .clamp(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
            if configured != current_interval_ms {
                current_interval_ms = configured;
                ticker = tokio::time::interval(Duration::from_millis(current_interval_ms));
                ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            }
            ticker.tick().await;
            let enabled = state
                .memory_trim_enabled
                .load(std::sync::atomic::Ordering::Relaxed);
            if enabled {
                if let Err(err) = trim_working_set() {
                    tracing::debug!("memory trim skipped/failed: {err}");
                }
            }
            let system_enabled = state
                .memory_trim_system_enabled
                .load(std::sync::atomic::Ordering::Relaxed);
            if system_enabled {
                if let Err(err) = trim_all_processes_working_set() {
                    tracing::debug!("system memory trim skipped/failed: {err}");
                }
            }
        }
    });
}

#[cfg(windows)]
fn trim_working_set() -> anyhow::Result<()> {
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::GetCurrentProcess;

    unsafe {
        let handle = GetCurrentProcess();
        let ok = EmptyWorkingSet(handle);
        if ok == 0 {
            return Err(anyhow::anyhow!(std::io::Error::last_os_error()));
        }
    }

    Ok(())
}

#[cfg(windows)]
fn trim_all_processes_working_set() -> anyhow::Result<()> {
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA,
    };
    use windows_sys::Win32::Foundation::{CloseHandle, ERROR_NO_MORE_FILES};

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            return Err(anyhow::anyhow!("CreateToolhelp32Snapshot failed"));
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let handle = OpenProcess(
                    PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA,
                    0,
                    entry.th32ProcessID,
                );
                if !handle.is_null() {
                    let _ = EmptyWorkingSet(handle);
                    CloseHandle(handle);
                }

                entry = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
                if Process32NextW(snapshot, &mut entry) == 0 {
                    let err = std::io::Error::last_os_error();
                    if err.raw_os_error() == Some(ERROR_NO_MORE_FILES as i32) {
                        break;
                    }
                    break;
                }
            }
        }

        CloseHandle(snapshot);
    }

    Ok(())
}

#[cfg(not(windows))]
fn trim_all_processes_working_set() -> anyhow::Result<()> {
    Ok(())
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
        commands::is_fullscreen_window_active,
        commands::set_window_system_topmost,
        commands::get_auto_start_enabled,
        commands::set_auto_start_enabled,
        commands::get_installation_mode,
        commands::uninstall_app,
        commands::toggle_overlay,
        commands::set_refresh_rate,
        commands::set_memory_trim_enabled,
        commands::set_memory_trim_system_enabled,
        commands::set_memory_trim_interval,
        commands::save_export_config,
        commands::confirm_factory_reset,
        commands::get_shutdown_plan,
        commands::schedule_shutdown,
        commands::cancel_shutdown_schedule,
        commands::exit_app,
        commands::start_profile_capture,
        commands::stop_profile_capture,
        commands::get_profile_status
    ])
}
