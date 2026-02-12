use tauri::{Manager, Runtime};

pub fn setup_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show = tauri::menu::MenuItemBuilder::with_id("show_main", "Show PulseCore").build(app)?;
    let overlay = tauri::menu::MenuItemBuilder::with_id("toggle_overlay", "Toggle Overlay").build(app)?;
    let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = tauri::menu::MenuBuilder::new(app)
        .items(&[&show, &overlay, &quit])
        .build()?;

    let _tray = tauri::tray::TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "toggle_overlay" => {
                let overlay = if let Some(overlay) = app.get_webview_window("overlay") {
                    overlay
                } else {
                    match tauri::WebviewWindowBuilder::new(app, "overlay", tauri::WebviewUrl::App("index.html#/overlay".into()))
                        .title("PulseCore Overlay")
                        .always_on_top(true)
                        .resizable(false)
                        .maximizable(false)
                        .decorations(false)
                        .transparent(true)
                        .inner_size(340.0, 260.0)
                        .skip_taskbar(true)
                        .build()
                    {
                        Ok(win) => win,
                        Err(_) => return,
                    }
                };

                if overlay.is_visible().unwrap_or(false) {
                    let _ = overlay.hide();
                } else {
                    let _ = overlay.show();
                    let _ = overlay.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
