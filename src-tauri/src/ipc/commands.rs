use chrono::Utc;
#[cfg(windows)]
use std::process::Command;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};

use crate::{
    core::device_info,
    profiler::{ensure_profile_path, ProfileStatus},
    state::SharedState,
    types::{AppBootstrap, ScheduleShutdownRequest, ShutdownPlan},
};

type CmdResult<T> = Result<T, String>;

const AUTOSTART_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_VALUE: &str = "PulseCoreLite";
const SHUTDOWN_TASK_NAME: &str = "PulseCoreLite_Shutdown";
const SHUTDOWN_PLAN_FILE: &str = "shutdown-plan.json";

fn shutdown_plan_path(app: &AppHandle) -> CmdResult<PathBuf> {
    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push(SHUTDOWN_PLAN_FILE);
    Ok(dir)
}

fn write_shutdown_plan(app: &AppHandle, plan: &ShutdownPlan) -> CmdResult<()> {
    let path = shutdown_plan_path(app)?;
    let json = serde_json::to_string_pretty(plan).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn clear_shutdown_plan_file(app: &AppHandle) {
    if let Ok(path) = shutdown_plan_path(app) {
        let _ = fs::remove_file(path);
    }
}

fn read_shutdown_plan(app: &AppHandle) -> Option<ShutdownPlan> {
    let path = shutdown_plan_path(app).ok()?;
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<ShutdownPlan>(&text).ok()
}

#[cfg(windows)]
const UNINSTALL_ROOT_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn open_autostart_key(access: u32) -> CmdResult<windows_sys::Win32::System::Registry::HKEY> {
    use windows_sys::Win32::System::Registry::{RegOpenKeyExW, HKEY_CURRENT_USER};
    let mut key: windows_sys::Win32::System::Registry::HKEY = std::ptr::null_mut();
    let path = to_wide(AUTOSTART_KEY);
    let status = unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, path.as_ptr(), 0, access, &mut key) };
    if status != 0 {
        return Err(format!("open registry key failed: {status}"));
    }
    Ok(key)
}

#[cfg(windows)]
fn read_autostart_value() -> CmdResult<bool> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegQueryValueExW, KEY_QUERY_VALUE, REG_SZ,
    };
    let key = open_autostart_key(KEY_QUERY_VALUE)?;
    let name = to_wide(AUTOSTART_VALUE);
    let mut value_type: u32 = 0;
    let mut data_len: u32 = 0;
    let status = unsafe {
        RegQueryValueExW(
            key,
            name.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut data_len,
        )
    };
    unsafe {
        RegCloseKey(key);
    }
    if status == 0 {
        return Ok(value_type == REG_SZ);
    }
    if status == ERROR_FILE_NOT_FOUND {
        return Ok(false);
    }
    Err(format!("query registry value failed: {status}"))
}

#[cfg(windows)]
fn write_autostart_value(enabled: bool) -> CmdResult<bool> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegSetValueExW, KEY_SET_VALUE, REG_SZ,
    };
    let key = open_autostart_key(KEY_SET_VALUE)?;
    let name = to_wide(AUTOSTART_VALUE);
    if enabled {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = format!("\"{}\"", exe.to_string_lossy());
        let data = to_wide(&exe_str);
        let data_len = (data.len() * 2) as u32;
        let status = unsafe {
            RegSetValueExW(
                key,
                name.as_ptr(),
                0,
                REG_SZ,
                data.as_ptr() as *const u8,
                data_len,
            )
        };
        unsafe {
            RegCloseKey(key);
        }
        if status != 0 {
            return Err(format!("set registry value failed: {status}"));
        }
        return Ok(true);
    }
    let status = unsafe { RegDeleteValueW(key, name.as_ptr()) };
    unsafe {
        RegCloseKey(key);
    }
    if status == 0 || status == ERROR_FILE_NOT_FOUND {
        return Ok(true);
    }
    Err(format!("delete registry value failed: {status}"))
}

#[tauri::command]
pub async fn get_initial_state(state: State<'_, SharedState>) -> CmdResult<AppBootstrap> {
    Ok(AppBootstrap {
        settings: state.settings.read().await.clone(),
        hardware_info: state.hardware_info.read().await.clone(),
        latest_snapshot: state.latest_snapshot.read().await.clone(),
    })
}

#[tauri::command]
pub fn confirm_factory_reset(title: String, message: String) -> CmdResult<bool> {
    #[cfg(windows)]
    {
        use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, IDYES, MB_ICONWARNING, MB_SETFOREGROUND, MB_TOPMOST, MB_YESNO,
        };

        let title_w: Vec<u16> = OsStr::new(&title)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let message_w: Vec<u16> = OsStr::new(&message)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Use a native system dialog (not a webview `window.confirm`).
        // Owner window is null to avoid HWND plumbing; this still shows a real OS dialog.
        let result = unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                message_w.as_ptr(),
                title_w.as_ptr(),
                MB_YESNO | MB_ICONWARNING | MB_TOPMOST | MB_SETFOREGROUND,
            )
        };

        return Ok(result == IDYES);
    }

    #[cfg(not(windows))]
    {
        let _ = title;
        let _ = message;
        Err("System dialog is not implemented for this platform.".to_string())
    }
}

#[tauri::command]
pub fn get_auto_start_enabled() -> CmdResult<bool> {
    #[cfg(windows)]
    {
        return read_autostart_value();
    }
    #[cfg(not(windows))]
    {
        Err("Autostart is not supported on this platform.".to_string())
    }
}

#[tauri::command]
pub async fn start_profile_capture(
    app: AppHandle,
    state: State<'_, SharedState>,
    path: String,
    interval_ms: u64,
    duration_ms: Option<u64>,
) -> CmdResult<ProfileStatus> {
    let mut profiler_lock = state.profiler.lock().await;
    if profiler_lock.is_some() {
        return Err("Profile capture already running.".to_string());
    }

    let resolved = ensure_profile_path(&path);
    let handle = crate::profiler::start_profile_capture(
        app,
        state.inner().clone(),
        resolved,
        interval_ms,
        duration_ms,
    )
    .await?;

    let status = handle.status();
    *profiler_lock = Some(handle);
    Ok(status)
}

#[tauri::command]
pub async fn stop_profile_capture(state: State<'_, SharedState>) -> CmdResult<ProfileStatus> {
    let handle = {
        let mut profiler_lock = state.profiler.lock().await;
        profiler_lock.take()
    };

    if let Some(handle) = handle {
        let status = handle.status();
        handle.stop().await;
        return Ok(ProfileStatus {
            active: false,
            path: status.path,
            started_at: status.started_at,
            samples: status.samples,
        });
    }

    Ok(ProfileStatus {
        active: false,
        path: None,
        started_at: None,
        samples: 0,
    })
}

#[tauri::command]
pub async fn get_profile_status(state: State<'_, SharedState>) -> CmdResult<ProfileStatus> {
    let profiler_lock = state.profiler.lock().await;
    if let Some(handle) = profiler_lock.as_ref() {
        return Ok(handle.status());
    }
    Ok(ProfileStatus {
        active: false,
        path: None,
        started_at: None,
        samples: 0,
    })
}

#[tauri::command]
pub fn set_auto_start_enabled(enabled: bool) -> CmdResult<bool> {
    #[cfg(windows)]
    {
        return write_autostart_value(enabled);
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Autostart is not supported on this platform.".to_string())
    }
}

#[cfg(windows)]
fn reg_query_string_value(
    key: windows_sys::Win32::System::Registry::HKEY,
    name: &str,
) -> Option<String> {
    use windows_sys::Win32::System::Registry::{RegQueryValueExW, REG_EXPAND_SZ, REG_SZ};

    let name_w = to_wide(name);
    let mut value_type: u32 = 0;
    let mut data_len: u32 = 0;
    let status = unsafe {
        RegQueryValueExW(
            key,
            name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut data_len,
        )
    };
    if status != 0 || data_len < 2 {
        return None;
    }
    if value_type != REG_SZ && value_type != REG_EXPAND_SZ {
        return None;
    }

    // data_len is in bytes.
    let mut buf: Vec<u16> = vec![0u16; (data_len as usize + 1) / 2];
    let status = unsafe {
        RegQueryValueExW(
            key,
            name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            buf.as_mut_ptr() as *mut u8,
            &mut data_len,
        )
    };
    if status != 0 {
        return None;
    }

    let end = buf.iter().position(|c| *c == 0).unwrap_or(buf.len());
    let text = String::from_utf16_lossy(&buf[..end]).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(windows)]
fn reg_enum_subkeys(key: windows_sys::Win32::System::Registry::HKEY) -> Vec<String> {
    use windows_sys::Win32::Foundation::ERROR_NO_MORE_ITEMS;
    use windows_sys::Win32::System::Registry::RegEnumKeyExW;

    let mut index: u32 = 0;
    let mut names: Vec<String> = Vec::new();
    loop {
        let mut name_buf: [u16; 512] = [0; 512];
        let mut name_len: u32 = (name_buf.len() - 1) as u32;
        let status = unsafe {
            RegEnumKeyExW(
                key,
                index,
                name_buf.as_mut_ptr(),
                &mut name_len,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if status == ERROR_NO_MORE_ITEMS {
            break;
        }
        if status != 0 {
            break;
        }
        let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        if !name.trim().is_empty() {
            names.push(name);
        }
        index += 1;
    }
    names
}

#[cfg(windows)]
fn normalize_registry_path(value: &str) -> String {
    // Registry values like DisplayIcon may be `"C:\Path\App.exe",0`.
    let trimmed = value.trim().trim_matches('"');
    let before_comma = trimmed.split(',').next().unwrap_or(trimmed).trim();
    before_comma.trim_matches('"').to_string()
}

#[cfg(windows)]
fn find_uninstall_string() -> Option<String> {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ,
        KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    };

    let exe = std::env::current_exe().ok()?;
    let exe_str = exe.to_string_lossy().to_string();
    let exe_lower = exe_str.to_lowercase();
    let exe_dir_lower = exe
        .parent()
        .map(|p| p.to_string_lossy().to_string().to_lowercase())
        .unwrap_or_default();

    let views: [u32; 3] = [0, KEY_WOW64_64KEY, KEY_WOW64_32KEY];
    let roots: [HKEY; 2] = [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER];

    for root in roots {
        for view in views {
            let mut uninstall_root: HKEY = std::ptr::null_mut();
            let root_path = to_wide(UNINSTALL_ROOT_KEY);
            let status = unsafe {
                RegOpenKeyExW(
                    root,
                    root_path.as_ptr(),
                    0,
                    KEY_READ | view,
                    &mut uninstall_root,
                )
            };
            if status != 0 || uninstall_root.is_null() {
                continue;
            }

            let subkeys = reg_enum_subkeys(uninstall_root);
            for sub in subkeys {
                let mut entry_key: HKEY = std::ptr::null_mut();
                let entry_path = to_wide(&format!("{UNINSTALL_ROOT_KEY}\\{sub}"));
                let status = unsafe {
                    RegOpenKeyExW(
                        root,
                        entry_path.as_ptr(),
                        0,
                        KEY_READ | view,
                        &mut entry_key,
                    )
                };
                if status != 0 || entry_key.is_null() {
                    continue;
                }

                let uninstall = reg_query_string_value(entry_key, "UninstallString");
                if uninstall.is_none() {
                    unsafe { RegCloseKey(entry_key) };
                    continue;
                }

                let display_icon = reg_query_string_value(entry_key, "DisplayIcon")
                    .map(|s| normalize_registry_path(&s));
                let install_location = reg_query_string_value(entry_key, "InstallLocation")
                    .map(|s| normalize_registry_path(&s));
                let display_name = reg_query_string_value(entry_key, "DisplayName");

                let mut matches = false;
                if let Some(icon) = &display_icon {
                    if icon.eq_ignore_ascii_case(&exe_str) {
                        matches = true;
                    } else if !exe_dir_lower.is_empty()
                        && icon.to_lowercase().starts_with(&exe_dir_lower)
                    {
                        matches = true;
                    }
                }
                if !matches {
                    if let Some(loc) = &install_location {
                        let loc_lower =
                            loc.to_lowercase().trim_end_matches('\\').to_string() + "\\";
                        if !loc_lower.trim().is_empty() && exe_lower.starts_with(&loc_lower) {
                            matches = true;
                        }
                    }
                }
                if !matches {
                    if let Some(name) = &display_name {
                        // Fallback: match by known branding, but only if the uninstall entry looks plausible.
                        let n = name.to_lowercase();
                        if (n.contains("pulsecore") || n.contains("pulse core"))
                            && uninstall.as_ref().is_some()
                        {
                            matches = true;
                        }
                    }
                }

                unsafe { RegCloseKey(entry_key) };
                if matches {
                    unsafe { RegCloseKey(uninstall_root) };
                    return uninstall;
                }
            }

            unsafe { RegCloseKey(uninstall_root) };
        }
    }

    None
}

#[cfg(windows)]
fn is_installed_build() -> Option<bool> {
    Some(find_uninstall_string().is_some())
}

#[cfg(windows)]
fn confirm_yes_no_system(title: &str, message: &str) -> CmdResult<bool> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_ICONWARNING, MB_SETFOREGROUND, MB_TOPMOST, MB_YESNO,
    };

    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    let title_w: Vec<u16> = OsStr::new(title)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let message_w: Vec<u16> = OsStr::new(message)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let result = unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message_w.as_ptr(),
            title_w.as_ptr(),
            MB_YESNO | MB_ICONWARNING | MB_TOPMOST | MB_SETFOREGROUND,
        )
    };

    Ok(result == IDYES)
}

#[cfg(windows)]
fn split_uninstall_command(command: &str) -> Vec<String> {
    let mut parts: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in command.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
            }
            ' ' | '\t' if !in_quotes => {
                if !current.is_empty() {
                    parts.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

#[cfg(windows)]
fn spawn_uninstaller_cmd(uninstall: &str) -> CmdResult<()> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let parts = split_uninstall_command(uninstall);
    let (exe, args) = parts
        .split_first()
        .ok_or_else(|| "uninstall command is empty".to_string())?;
    Command::new(exe)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("failed to start uninstaller: {e}"))?;

    Ok(())
}

#[cfg(windows)]
fn spawn_data_cleanup_cmd(app: &AppHandle) -> CmdResult<()> {
    use std::collections::BTreeSet;
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut dirs: BTreeSet<String> = BTreeSet::new();
    let resolver = app.path();

    // Best-effort: remove all known app data/config/cache/log dirs.
    for dir in [
        resolver.app_config_dir().ok(),
        resolver.app_data_dir().ok(),
        resolver.app_local_data_dir().ok(),
        resolver.app_cache_dir().ok(),
        resolver.app_log_dir().ok(),
    ]
    .into_iter()
    .flatten()
    {
        let text = dir.to_string_lossy().to_string();
        if !text.trim().is_empty() {
            dirs.insert(text);
        }
    }

    if dirs.is_empty() {
        return Ok(());
    }

    // Delay a bit so our WebView/profile files are released, then delete.
    let mut script = "ping 127.0.0.1 -n 3 >NUL".to_string();
    for dir in dirs {
        script.push_str(&format!(" & if exist \"{dir}\" rmdir /s /q \"{dir}\""));
    }

    Command::new("cmd.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/C", &script])
        .spawn()
        .map_err(|e| format!("failed to schedule data cleanup: {e}"))?;

    Ok(())
}

#[cfg(windows)]
fn parse_hhmm(value: &str) -> CmdResult<String> {
    let parts: Vec<&str> = value.trim().split(':').collect();
    if parts.len() != 2 {
        return Err("time must be in HH:mm format".to_string());
    }
    let hour: u8 = parts[0]
        .parse::<u8>()
        .map_err(|_| "invalid hour in time".to_string())?;
    let minute: u8 = parts[1]
        .parse::<u8>()
        .map_err(|_| "invalid minute in time".to_string())?;
    if hour > 23 || minute > 59 {
        return Err("time out of range".to_string());
    }
    Ok(format!("{hour:02}:{minute:02}"))
}

#[cfg(windows)]
fn weekday_to_schtasks(value: u8) -> CmdResult<&'static str> {
    match value {
        1 => Ok("MON"),
        2 => Ok("TUE"),
        3 => Ok("WED"),
        4 => Ok("THU"),
        5 => Ok("FRI"),
        6 => Ok("SAT"),
        7 => Ok("SUN"),
        _ => Err("weekday must be between 1 and 7".to_string()),
    }
}

#[cfg(windows)]
fn clear_existing_shutdown_schedule() {
    let _ = Command::new("shutdown").args(["/a"]).status();
    let _ = Command::new("schtasks")
        .args(["/Delete", "/TN", SHUTDOWN_TASK_NAME, "/F"])
        .status();
}

#[cfg(windows)]
fn schedule_shutdown_after(seconds: u64) -> CmdResult<()> {
    const SHUTDOWN_MAX_SECONDS: u64 = 315_360_000;
    if seconds > SHUTDOWN_MAX_SECONDS {
        return Err(format!(
            "countdown is too large (max {SHUTDOWN_MAX_SECONDS} seconds)"
        ));
    }
    let seconds_str = seconds.to_string();
    let status = Command::new("shutdown")
        .args(["/s", "/f", "/t", &seconds_str])
        .status()
        .map_err(|e| format!("failed to schedule shutdown: {e}"))?;
    if !status.success() {
        return Err("shutdown command failed".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn schedule_repeat_shutdown(
    mode: &str,
    time: &str,
    weekday: Option<u8>,
    day_of_month: Option<u8>,
) -> CmdResult<()> {
    let normalized_time = parse_hhmm(time)?;
    let mut cmd = Command::new("schtasks");
    cmd.args([
        "/Create",
        "/F",
        "/TN",
        SHUTDOWN_TASK_NAME,
        "/TR",
        "shutdown.exe /s /f /t 0",
    ]);

    match mode {
        "daily" => {
            cmd.args(["/SC", "DAILY"]);
        }
        "weekly" => {
            let value =
                weekday.ok_or_else(|| "weekday is required for weekly repeat".to_string())?;
            let day = weekday_to_schtasks(value)?;
            cmd.args(["/SC", "WEEKLY", "/D", day]);
        }
        "monthly" => {
            let value = day_of_month
                .ok_or_else(|| "dayOfMonth is required for monthly repeat".to_string())?;
            if !(1..=31).contains(&value) {
                return Err("dayOfMonth must be between 1 and 31".to_string());
            }
            let day = value.to_string();
            cmd.args(["/SC", "MONTHLY", "/D", &day]);
        }
        _ => return Err("invalid repeat mode".to_string()),
    }

    cmd.args(["/ST", &normalized_time]);
    let status = cmd
        .status()
        .map_err(|e| format!("failed to create scheduled task: {e}"))?;
    if !status.success() {
        return Err("schtasks create command failed".to_string());
    }
    Ok(())
}

fn normalize_shutdown_plan(mut plan: ShutdownPlan) -> Option<ShutdownPlan> {
    // One-off plans become stale after their deadline and should not be shown forever.
    if (plan.mode == "countdown" || plan.mode == "once") && plan.execute_at.is_some() {
        if let Some(execute_at) = plan.execute_at {
            if execute_at <= Utc::now() {
                return None;
            }
            plan.execute_at = Some(execute_at);
        }
    }
    Some(plan)
}

#[tauri::command]
pub async fn get_shutdown_plan(app: AppHandle) -> CmdResult<Option<ShutdownPlan>> {
    let plan = read_shutdown_plan(&app).and_then(normalize_shutdown_plan);
    if plan.is_none() {
        clear_shutdown_plan_file(&app);
    }
    Ok(plan)
}

#[tauri::command]
pub async fn cancel_shutdown_schedule(app: AppHandle) -> CmdResult<()> {
    #[cfg(windows)]
    {
        clear_existing_shutdown_schedule();
        clear_shutdown_plan_file(&app);
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        Err("shutdown scheduling is not supported on this platform.".to_string())
    }
}

#[tauri::command]
pub async fn schedule_shutdown(
    app: AppHandle,
    request: ScheduleShutdownRequest,
) -> CmdResult<ShutdownPlan> {
    #[cfg(windows)]
    {
        let now = Utc::now();
        let mode = request.mode.trim().to_lowercase();
        let plan = match mode.as_str() {
            "countdown" => {
                let seconds = request
                    .delay_seconds
                    .ok_or_else(|| "delaySeconds is required for countdown mode".to_string())?;
                if seconds == 0 {
                    return Err("countdown must be greater than 0 seconds".to_string());
                }
                clear_existing_shutdown_schedule();
                schedule_shutdown_after(seconds)?;
                ShutdownPlan {
                    mode,
                    created_at: now,
                    execute_at: Some(now + chrono::Duration::seconds(seconds as i64)),
                    countdown_seconds: Some(seconds),
                    time: None,
                    weekday: None,
                    day_of_month: None,
                }
            }
            "once" => {
                let execute_at = request
                    .execute_at
                    .ok_or_else(|| "executeAt is required for once mode".to_string())?;
                if execute_at <= now {
                    return Err("executeAt must be in the future".to_string());
                }
                let seconds = (execute_at - now).num_seconds() as u64;
                clear_existing_shutdown_schedule();
                schedule_shutdown_after(seconds.max(1))?;
                ShutdownPlan {
                    mode,
                    created_at: now,
                    execute_at: Some(execute_at),
                    countdown_seconds: Some(seconds.max(1)),
                    time: None,
                    weekday: None,
                    day_of_month: None,
                }
            }
            "daily" | "weekly" | "monthly" => {
                let time = request
                    .time
                    .as_deref()
                    .ok_or_else(|| "time is required for repeat mode".to_string())?;
                let normalized_time = parse_hhmm(time)?;
                clear_existing_shutdown_schedule();
                schedule_repeat_shutdown(
                    &mode,
                    &normalized_time,
                    request.weekday,
                    request.day_of_month,
                )?;
                ShutdownPlan {
                    mode,
                    created_at: now,
                    execute_at: None,
                    countdown_seconds: None,
                    time: Some(normalized_time),
                    weekday: request.weekday,
                    day_of_month: request.day_of_month,
                }
            }
            _ => {
                return Err("unsupported schedule mode".to_string());
            }
        };

        write_shutdown_plan(&app, &plan)?;
        return Ok(plan);
    }

    #[cfg(not(windows))]
    {
        let _ = (app, request);
        Err("shutdown scheduling is not supported on this platform.".to_string())
    }
}

#[tauri::command]
pub async fn get_installation_mode() -> CmdResult<String> {
    #[cfg(windows)]
    {
        if is_installed_build().unwrap_or(false) {
            return Ok("installed".to_string());
        }
        return Ok("portable".to_string());
    }

    #[cfg(not(windows))]
    {
        Ok("portable".to_string())
    }
}

#[tauri::command]
pub async fn uninstall_app(app: AppHandle, title: String, message: String) -> CmdResult<()> {
    #[cfg(windows)]
    {
        // Only supported for installed builds (portable shouldn't show the button).
        let uninstall =
            find_uninstall_string().ok_or_else(|| "uninstall is not available".to_string())?;

        let confirmed = confirm_yes_no_system(&title, &message)?;
        if !confirmed {
            return Ok(());
        }

        // Best-effort: disable autostart.
        let _ = write_autostart_value(false);

        // Spawn a background cleanup that runs shortly after we exit.
        spawn_data_cleanup_cmd(&app)?;

        // Spawn the system uninstaller (normal flow) and then exit our app.
        spawn_uninstaller_cmd(&uninstall)?;

        app.exit(0);
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let _ = (app, title, message);
        Err("uninstall is not supported on this platform.".to_string())
    }
}

#[tauri::command]
pub async fn toggle_overlay(app: AppHandle, visible: bool) -> CmdResult<bool> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    if visible {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        win.hide().map_err(|e| e.to_string())?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn set_refresh_rate(state: State<'_, SharedState>, rate_ms: u64) -> CmdResult<()> {
    use std::sync::atomic::Ordering;
    let rate = rate_ms.clamp(10, 10000);
    state.refresh_rate_ms.store(rate, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn set_memory_trim_enabled(state: State<'_, SharedState>, enabled: bool) -> CmdResult<()> {
    use std::sync::atomic::Ordering;
    state
        .memory_trim_enabled
        .store(enabled, Ordering::Relaxed);
    let mut settings = state.settings.write().await;
    settings.memory_trim_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub async fn set_memory_trim_system_enabled(
    state: State<'_, SharedState>,
    enabled: bool,
) -> CmdResult<()> {
    use std::sync::atomic::Ordering;
    state.memory_trim_system_enabled.store(enabled, Ordering::Relaxed);
    state.settings.write().await.memory_trim_system_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub async fn set_memory_trim_interval(
    state: State<'_, SharedState>,
    interval_minutes: u64,
) -> CmdResult<()> {
    use std::sync::atomic::Ordering;
    let minutes = interval_minutes.clamp(1, 30);
    let interval_ms = minutes * 60 * 1000;
    state
        .memory_trim_interval_ms
        .store(interval_ms, Ordering::Relaxed);
    let mut settings = state.settings.write().await;
    settings.memory_trim_interval_minutes = minutes as u8;
    Ok(())
}

#[tauri::command]
pub async fn save_export_config(path: String, content: String) -> CmdResult<()> {
    if path.trim().is_empty() {
        return Err("path is empty".to_string());
    }
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn exit_app(app: AppHandle) -> CmdResult<()> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn get_hardware_info(
    state: State<'_, SharedState>,
) -> CmdResult<crate::types::HardwareInfo> {
    let info = device_info::collect_hardware_info();
    let mut lock = state.hardware_info.write().await;
    *lock = info.clone();
    Ok(info)
}

#[tauri::command]
pub fn get_taskbar_info() -> CmdResult<Option<crate::types::TaskbarInfo>> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Shell::{SHAppBarMessage, ABM_GETTASKBARPOS, APPBARDATA};

        let mut data: APPBARDATA = unsafe { std::mem::zeroed() };
        data.cbSize = std::mem::size_of::<APPBARDATA>() as u32;

        // Returns non-zero on success.
        let ok = unsafe { SHAppBarMessage(ABM_GETTASKBARPOS, &mut data as *mut APPBARDATA) };
        if ok == 0 {
            return Ok(None);
        }

        return Ok(Some(crate::types::TaskbarInfo {
            edge: data.uEdge,
            left: data.rc.left,
            top: data.rc.top,
            right: data.rc.right,
            bottom: data.rc.bottom,
        }));
    }

    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn is_fullscreen_window_active() -> CmdResult<bool> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::RECT;
        use windows_sys::Win32::Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        };

        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd == std::ptr::null_mut() {
            return Ok(false);
        }
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return Ok(false);
        }
        if unsafe { IsIconic(hwnd) } != 0 {
            return Ok(false);
        }

        let mut pid: u32 = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, &mut pid);
        }
        if pid == std::process::id() {
            return Ok(false);
        }

        let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        if monitor == std::ptr::null_mut() {
            return Ok(false);
        }

        let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
            return Ok(false);
        }

        let mut rect: RECT = unsafe { std::mem::zeroed() };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return Ok(false);
        }

        let win_width = rect.right - rect.left;
        let win_height = rect.bottom - rect.top;
        let monitor_width = info.rcMonitor.right - info.rcMonitor.left;
        let monitor_height = info.rcMonitor.bottom - info.rcMonitor.top;

        if win_width <= 0 || win_height <= 0 || monitor_width <= 0 || monitor_height <= 0 {
            return Ok(false);
        }

        let width_ratio = win_width as f64 / monitor_width as f64;
        let height_ratio = win_height as f64 / monitor_height as f64;
        let area_ratio =
            (win_width as f64 * win_height as f64) / (monitor_width as f64 * monitor_height as f64);

        Ok(width_ratio >= 0.98 && height_ratio >= 0.98 && area_ratio >= 0.95)
    }

    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn set_window_system_topmost(app: AppHandle, label: String, topmost: bool) -> CmdResult<()> {
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window not found: {label}"))?;

    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{GetLastError, HWND};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };

        let hwnd = win.hwnd().map_err(|e| e.to_string())?;
        let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;
        let hwnd_value = hwnd.0 as HWND;
        if topmost {
            // Two-step promote keeps the window at the front of the TOPMOST band.
            let _ = unsafe { SetWindowPos(hwnd_value, HWND_NOTOPMOST, 0, 0, 0, 0, flags) };
            let ok = unsafe { SetWindowPos(hwnd_value, HWND_TOPMOST, 0, 0, 0, 0, flags) };
            if ok == 0 {
                let code = unsafe { GetLastError() };
                return Err(format!("set window z-order failed: {code}"));
            }
        } else {
            let ok = unsafe { SetWindowPos(hwnd_value, HWND_NOTOPMOST, 0, 0, 0, 0, flags) };
            if ok == 0 {
                let code = unsafe { GetLastError() };
                return Err(format!("set window z-order failed: {code}"));
            }
        }
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        win.set_always_on_top(topmost).map_err(|e| e.to_string())?;
        Ok(())
    }
}
