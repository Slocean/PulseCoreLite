use tauri::{AppHandle, Manager, State};

use crate::{core::device_info, state::SharedState, types::AppBootstrap};

type CmdResult<T> = Result<T, String>;

const AUTOSTART_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_VALUE: &str = "PulseCoreLite";

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
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

        let title_w: Vec<u16> = OsStr::new(&title).encode_wide().chain(std::iter::once(0)).collect();
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
    let rate = rate_ms.clamp(100, 10000);
    state.refresh_rate_ms.store(rate, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn exit_app(app: AppHandle) -> CmdResult<()> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn get_hardware_info(state: State<'_, SharedState>) -> CmdResult<crate::types::HardwareInfo> {
    let info = device_info::collect_hardware_info();
    let mut lock = state.hardware_info.write().await;
    *lock = info.clone();
    Ok(info)
}

#[tauri::command]
pub fn get_taskbar_info() -> CmdResult<Option<crate::types::TaskbarInfo>> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Shell::{APPBARDATA, SHAppBarMessage, ABM_GETTASKBARPOS};

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


