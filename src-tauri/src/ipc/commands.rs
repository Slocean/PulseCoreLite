use tauri::{AppHandle, Manager, State};

use crate::{state::SharedState, types::AppBootstrap};

type CmdResult<T> = Result<T, String>;

#[tauri::command]
pub async fn get_initial_state(state: State<'_, SharedState>) -> CmdResult<AppBootstrap> {
    Ok(AppBootstrap {
        settings: state.settings.read().await.clone(),
        hardware_info: state.hardware_info.clone(),
        latest_snapshot: state.latest_snapshot.read().await.clone(),
    })
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


