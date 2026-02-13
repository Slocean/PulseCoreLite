use tauri::{AppHandle, Manager, State};

use crate::{core::device_info, state::SharedState, types::AppBootstrap};

type CmdResult<T> = Result<T, String>;

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


