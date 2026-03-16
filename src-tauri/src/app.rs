use std::time::Duration;

use chrono::{Datelike, Local, Timelike};
use tauri::{AppHandle, Emitter, Manager};

use crate::{ipc::commands, state::SharedState, types::TaskReminder};

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
            crate::native_taskbar::refresh(snapshot.clone());

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

pub fn start_task_reminder_loop(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn(async move {
        if let Some(store) = commands::read_task_reminder_store_file(&app) {
            let normalized = commands::normalize_task_reminder_store(store);
            *state.task_reminders.write().await = normalized.reminders;
            *state.reminder_smtp_config.write().await = normalized.smtp_config;
            state.reminder_last_fired.lock().await.clear();
        }

        let mut ticker = tokio::time::interval(Duration::from_millis(15_000));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            ticker.tick().await;
            if let Err(err) = tick_task_reminders(&app, &state).await {
                tracing::warn!("task reminder tick failed: {err}");
            }
        }
    });
}

async fn tick_task_reminders(app: &AppHandle, state: &SharedState) -> Result<(), String> {
    let now = Local::now();
    let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
    let weekday = now.weekday().number_from_monday() as u8;
    let day_of_month = now.day() as u8;
    let marker = format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day());

    {
        let mut fired = state.reminder_last_fired.lock().await;
        let suffix = format!("@{marker}");
        fired.retain(|key, _| key.ends_with(&suffix));
    }

    let reminders = state.task_reminders.read().await.clone();
    let smtp = state.reminder_smtp_config.read().await.clone();

    for reminder in reminders {
        if !reminder.enabled {
            continue;
        }
        let due_slots = collect_due_slots(&reminder, &current_time, weekday, day_of_month, &marker);
        if due_slots.is_empty() {
            continue;
        }

        for slot in due_slots {
            let fire_key = format!("{}|{}", reminder.id, slot);
            let should_fire = {
                let mut fired = state.reminder_last_fired.lock().await;
                if fired.contains_key(&fire_key) {
                    false
                } else {
                    fired.insert(fire_key.clone(), now.to_rfc3339());
                    true
                }
            };
            if !should_fire {
                continue;
            }

            if let Err(err) =
                commands::trigger_task_reminder_backend(app, smtp.clone(), &reminder).await
            {
                tracing::warn!("trigger reminder failed ({}): {err}", reminder.id);
                state.reminder_last_fired.lock().await.remove(&fire_key);
            }
        }
    }

    Ok(())
}

fn collect_due_slots(
    reminder: &TaskReminder,
    current_time: &str,
    weekday: u8,
    day_of_month: u8,
    marker: &str,
) -> Vec<String> {
    let mut due = Vec::new();

    for time in &reminder.daily_times {
        if time == current_time {
            due.push(format!("daily@{time}@{marker}"));
        }
    }
    for slot in &reminder.weekly_slots {
        if slot.weekday == weekday && slot.time == current_time {
            due.push(format!("weekly@{}-{}@{marker}", slot.weekday, slot.time));
        }
    }
    for slot in &reminder.monthly_slots {
        if slot.day == day_of_month && slot.time == current_time {
            due.push(format!("monthly@{}-{}@{marker}", slot.day, slot.time));
        }
    }

    due
}

#[cfg(windows)]
fn trim_working_set() -> anyhow::Result<()> {
    use std::collections::{HashMap, HashSet};

    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA,
    };

    unsafe {
        let root_pid = GetCurrentProcessId();
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return Err(anyhow::anyhow!("CreateToolhelp32Snapshot failed"));
        }

        let mut children_by_parent: HashMap<u32, Vec<u32>> = HashMap::new();
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                children_by_parent
                    .entry(entry.th32ParentProcessID)
                    .or_default()
                    .push(entry.th32ProcessID);

                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);

        let mut process_stack = vec![root_pid];
        let mut visited = HashSet::new();
        let mut trimmed_any = false;

        while let Some(pid) = process_stack.pop() {
            if !visited.insert(pid) {
                continue;
            }

            if let Some(children) = children_by_parent.get(&pid) {
                process_stack.extend(children.iter().copied());
            }

            let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, 0, pid);
            if handle.is_null() {
                continue;
            }

            let ok = EmptyWorkingSet(handle);
            CloseHandle(handle);
            if ok != 0 {
                trimmed_any = true;
            }
        }

        if !trimmed_any {
            return Err(anyhow::anyhow!(
                "EmptyWorkingSet failed for app process tree"
            ));
        }
    }

    Ok(())
}

#[cfg(windows)]
fn trim_all_processes_working_set() -> anyhow::Result<()> {
    use windows_sys::Win32::Foundation::{CloseHandle, ERROR_NO_MORE_FILES};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_SET_QUOTA,
    };

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
        crate::local_ai::get_local_ai_status,
        crate::local_ai::start_local_ai_runtime,
        crate::local_ai::stop_local_ai_runtime,
        crate::local_ai::send_local_ai_message,
        commands::configure_native_taskbar_monitor,
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
        commands::get_profile_status,
        commands::get_profile_output_dir,
        commands::open_profile_output_path,
        commands::send_reminder_email,
        commands::force_close_reminder_screens,
        commands::debug_log,
        commands::get_task_reminder_store,
        commands::save_task_reminder_store,
        commands::trigger_task_reminder_now
    ])
}
