use crate::{
    state::SharedState,
    types::{AppSettings, NativeTaskbarConfig, TaskbarInfo, TelemetrySnapshot},
};

#[cfg(windows)]
mod imp {
    use super::*;
    use std::{
        collections::VecDeque,
        ffi::OsStr,
        os::windows::ffi::OsStrExt,
        ptr,
        sync::{
            atomic::{AtomicBool, AtomicIsize, Ordering},
            Arc, Mutex, OnceLock,
        },
        thread,
        time::Duration,
    };

    use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
    use windows_sys::Win32::{
        Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, RECT, WPARAM},
        Graphics::Gdi::{
            BeginPaint, CreateSolidBrush, DEFAULT_GUI_FONT, DT_END_ELLIPSIS, DT_LEFT,
            DT_NOPREFIX, DT_SINGLELINE, DT_VCENTER, DeleteObject, DrawTextW, EndPaint, FillRect,
            GetStockObject, PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor, TRANSPARENT,
        },
        UI::{
            Shell::{ABM_GETTASKBARPOS, APPBARDATA, SHAppBarMessage},
            WindowsAndMessaging::{
                AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu,
                DestroyWindow, DispatchMessageW, GetCursorPos, GetMessageW, LoadCursorW,
                PostMessageW, PostQuitMessage, RegisterClassW, SetLayeredWindowAttributes,
                SetWindowPos, ShowWindow, TrackPopupMenu, TranslateMessage, CS_DBLCLKS,
                CW_USEDEFAULT, HMENU, HTCAPTION, HWND_NOTOPMOST, HWND_TOPMOST, IDC_ARROW,
                LWA_ALPHA, MF_SEPARATOR, MF_STRING, MSG, SW_HIDE, SW_SHOWNOACTIVATE,
                SWP_NOACTIVATE, TPM_LEFTALIGN, TPM_RETURNCMD, TPM_RIGHTBUTTON, WM_APP,
                WM_DESTROY, WM_LBUTTONDBLCLK, WM_NCHITTEST, WM_PAINT, WM_RBUTTONUP,
                WNDCLASSW, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
            },
        },
    };

    unsafe extern "system" {
        fn GetClientRect(hwnd: HWND, lp_rect: *mut RECT) -> i32;
        fn InvalidateRect(hwnd: HWND, lp_rect: *const RECT, erase: i32) -> i32;
        fn MessageBeep(u_type: u32) -> i32;
        fn UpdateWindow(hwnd: HWND) -> i32;
    }

    const CLASS_NAME: &str = "PulseCoreLiteNativeTaskbarWindow";
    const WINDOW_TITLE: &str = "PulseCoreLite Native Taskbar";
    const WM_APPLY_COMMANDS: u32 = WM_APP + 0x52;
    const MENU_SHOW_OR_HIDE_MAIN: usize = 1001;
    const MENU_EXIT_APP: usize = 1002;

    #[derive(Clone)]
    enum NativeTaskbarCommand {
        ApplyConfig(NativeTaskbarConfig),
        UpdateSnapshot(TelemetrySnapshot),
        Close,
    }

    #[derive(Clone, Default)]
    struct NativeTaskbarModel {
        line1: String,
        line2: String,
    }

    struct NativeTaskbarShared {
        hwnd: AtomicIsize,
        running: AtomicBool,
        queue: Mutex<VecDeque<NativeTaskbarCommand>>,
        app: Mutex<Option<AppHandle>>,
        state: Mutex<Option<SharedState>>,
        config: Mutex<Option<NativeTaskbarConfig>>,
        model: Mutex<NativeTaskbarModel>,
    }

    impl NativeTaskbarShared {
        fn new() -> Self {
            Self {
                hwnd: AtomicIsize::new(0),
                running: AtomicBool::new(false),
                queue: Mutex::new(VecDeque::new()),
                app: Mutex::new(None),
                state: Mutex::new(None),
                config: Mutex::new(None),
                model: Mutex::new(NativeTaskbarModel::default()),
            }
        }

        fn hwnd(&self) -> HWND {
            self.hwnd.load(Ordering::Relaxed) as HWND
        }

        fn set_hwnd(&self, hwnd: HWND) {
            self.hwnd.store(hwnd as isize, Ordering::Relaxed);
        }
    }

    static SHARED: OnceLock<Arc<NativeTaskbarShared>> = OnceLock::new();

    fn shared() -> Arc<NativeTaskbarShared> {
        SHARED
            .get_or_init(|| Arc::new(NativeTaskbarShared::new()))
            .clone()
    }

    fn to_wide(value: &str) -> Vec<u16> {
        OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn rgb(r: u8, g: u8, b: u8) -> COLORREF {
        r as u32 | ((g as u32) << 8) | ((b as u32) << 16)
    }

    fn config_colors(config: &NativeTaskbarConfig) -> (COLORREF, COLORREF, u8) {
        match config.background_mode.as_str() {
            "light" => (rgb(245, 247, 250), rgb(30, 35, 42), 245),
            "transparent" => (rgb(18, 23, 30), rgb(245, 247, 250), 220),
            _ => (rgb(24, 29, 38), rgb(240, 243, 246), 240),
        }
    }

    fn get_taskbar_info_inner() -> Option<TaskbarInfo> {
        let mut data: APPBARDATA = unsafe { std::mem::zeroed() };
        data.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
        let ok = unsafe { SHAppBarMessage(ABM_GETTASKBARPOS, &mut data as *mut APPBARDATA) };
        if ok == 0 {
            return None;
        }
        Some(TaskbarInfo {
            edge: data.uEdge,
            left: data.rc.left,
            top: data.rc.top,
            right: data.rc.right,
            bottom: data.rc.bottom,
        })
    }

    fn is_fullscreen_window_active_inner() -> bool {
        use windows_sys::Win32::Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        };

        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_null() {
            return false;
        }
        if unsafe { IsWindowVisible(hwnd) } == 0 || unsafe { IsIconic(hwnd) } != 0 {
            return false;
        }

        let mut pid: u32 = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, &mut pid);
        }
        if pid == std::process::id() {
            return false;
        }

        let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        if monitor.is_null() {
            return false;
        }

        let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
            return false;
        }

        let mut rect: RECT = unsafe { std::mem::zeroed() };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            return false;
        }

        let win_width = rect.right - rect.left;
        let win_height = rect.bottom - rect.top;
        let monitor_width = info.rcMonitor.right - info.rcMonitor.left;
        let monitor_height = info.rcMonitor.bottom - info.rcMonitor.top;
        if win_width <= 0 || win_height <= 0 || monitor_width <= 0 || monitor_height <= 0 {
            return false;
        }
        let width_ratio = win_width as f64 / monitor_width as f64;
        let height_ratio = win_height as f64 / monitor_height as f64;
        let area_ratio =
            (win_width as f64 * win_height as f64) / (monitor_width as f64 * monitor_height as f64);
        width_ratio >= 0.98 && height_ratio >= 0.98 && area_ratio >= 0.95
    }

    fn wake_window(shared: &NativeTaskbarShared) {
        let hwnd = shared.hwnd();
        if !hwnd.is_null() {
            unsafe {
                PostMessageW(hwnd, WM_APPLY_COMMANDS, 0, 0);
            }
        }
    }

    fn push_command(command: NativeTaskbarCommand) {
        let shared = shared();
        if let Ok(mut queue) = shared.queue.lock() {
            queue.push_back(command);
        }
        wake_window(&shared);
    }

    fn retain_pending_commands(mut predicate: impl FnMut(&NativeTaskbarCommand) -> bool) {
        let shared = shared();
        {
            let mut queue = match shared.queue.lock() {
                Ok(queue) => queue,
                Err(_) => return,
            };
            queue.retain(|command| predicate(command));
        }
    }

    fn format_speed(bytes_per_sec: f64) -> String {
        format!("{:.1} MB/s", bytes_per_sec / 1024.0 / 1024.0)
    }

    fn format_latency(latency_ms: Option<f64>, language: &str) -> String {
        match latency_ms {
            Some(value) if value.is_finite() => format!("{:.0}ms", value),
            _ => {
                if language == "zh-CN" {
                    "暂无".to_string()
                } else {
                    "N/A".to_string()
                }
            }
        }
    }

    fn build_segments(snapshot: &TelemetrySnapshot, config: &NativeTaskbarConfig) -> Vec<String> {
        let mut parts = Vec::new();
        if config.show_cpu {
            let mut text = format!("CPU {:.0}%", snapshot.cpu.usage_pct);
            if config.show_cpu_freq {
                if let Some(freq) = snapshot.cpu.frequency_mhz {
                    text.push_str(&format!(" {}MHz", freq));
                }
            }
            if config.show_cpu_temp {
                if let Some(temp) = snapshot.cpu.temperature_c {
                    text.push_str(&format!(" {:.0}°C", temp));
                }
            }
            parts.push(text);
        }
        if config.show_gpu {
            let usage = snapshot.gpu.usage_pct.unwrap_or(0.0);
            let mut text = format!("GPU {:.0}%", usage);
            if config.show_gpu_temp {
                if let Some(temp) = snapshot.gpu.temperature_c {
                    text.push_str(&format!(" {:.0}°C", temp));
                }
            }
            parts.push(text);
        }
        if config.show_memory {
            parts.push(format!("RAM {:.0}%", snapshot.memory.usage_pct));
        }
        if config.show_app {
            let mut text = format!("APP {:.1}%", snapshot.app_cpu_usage_pct.unwrap_or(0.0));
            if let Some(mem) = snapshot.app_memory_mb {
                text.push_str(&format!(" {:.0}MB", mem));
            }
            parts.push(text);
        }
        if config.show_down {
            parts.push(format!("↓ {}", format_speed(snapshot.network.download_bytes_per_sec)));
        }
        if config.show_up {
            parts.push(format!("↑ {}", format_speed(snapshot.network.upload_bytes_per_sec)));
        }
        if config.show_latency {
            parts.push(format!("L {}", format_latency(snapshot.network.latency_ms, &config.language)));
        }
        if parts.is_empty() {
            parts.push("PulseCoreLite".to_string());
        }
        parts
    }

    fn build_model(snapshot: &TelemetrySnapshot, config: &NativeTaskbarConfig) -> NativeTaskbarModel {
        let parts = build_segments(snapshot, config);
        if config.two_line_mode {
            let split = ((parts.len() as f64) / 2.0).ceil() as usize;
            let (top, bottom) = parts.split_at(split.max(1).min(parts.len()));
            NativeTaskbarModel {
                line1: top.join("   "),
                line2: bottom.join("   "),
            }
        } else {
            NativeTaskbarModel {
                line1: parts.join("  |  "),
                line2: String::new(),
            }
        }
    }

    fn with_state_settings<T>(shared: &NativeTaskbarShared, map: impl FnOnce(&AppSettings) -> T) -> Option<T> {
        let state = shared.state.lock().ok()?.clone()?;
        let settings = tauri::async_runtime::block_on(async { state.settings.read().await.clone() });
        Some(map(&settings))
    }

    fn show_or_create_main_window(app: &AppHandle, shared: &NativeTaskbarShared) {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
            return;
        }
        let always_on_top = with_state_settings(shared, |settings| settings.overlay_always_on_top).unwrap_or(true);
        let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("PulseCoreLite Overlay")
            .inner_size(340.0, 260.0)
            .resizable(false)
            .maximizable(false)
            .minimizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(always_on_top)
            .visible(true)
            .skip_taskbar(false)
            .focused(true);
        match builder.build() {
            Ok(win) => {
                let _ = win.show();
                let _ = win.set_focus();
            }
            Err(err) => {
                tracing::warn!("failed to create main window from native taskbar: {err}");
                unsafe {
                    MessageBeep(0xFFFF_FFFF);
                }
            }
        }
    }

    fn close_main_window(app: &AppHandle) {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.close();
        }
    }

    fn toggle_main_window(app: &AppHandle, shared: &NativeTaskbarShared) {
        if let Some(win) = app.get_webview_window("main") {
            if win.is_visible().unwrap_or(false) {
                close_main_window(app);
            } else {
                let _ = win.show();
                let _ = win.set_focus();
            }
            return;
        }
        show_or_create_main_window(app, shared);
    }

    fn apply_window_frame(hwnd: HWND, config: &NativeTaskbarConfig, model: &NativeTaskbarModel) {
        if hwnd.is_null() {
            return;
        }
        let taskbar_info = get_taskbar_info_inner();
        let width = 640;
        let height = if config.two_line_mode || !model.line2.is_empty() { 48 } else { 28 };
        let (mut x, mut y) = (CW_USEDEFAULT, CW_USEDEFAULT);
        if let Some(info) = taskbar_info {
            match info.edge {
                3 => {
                    x = info.right - width - 8;
                    y = info.top - height;
                }
                1 => {
                    x = info.right - width - 8;
                    y = info.bottom;
                }
                0 => {
                    x = info.right;
                    y = info.bottom - height - 8;
                }
                2 => {
                    x = info.left - width;
                    y = info.bottom - height - 8;
                }
                _ => {
                    x = info.right - width - 8;
                    y = info.top - height;
                }
            }
        }

        let insert_after = if config.always_on_top { HWND_TOPMOST } else { HWND_NOTOPMOST };
        unsafe {
            SetWindowPos(hwnd, insert_after, x, y, width, height, SWP_NOACTIVATE);
            SetLayeredWindowAttributes(hwnd, 0, config_colors(config).2, LWA_ALPHA);
        }
        if config.auto_hide_on_fullscreen && is_fullscreen_window_active_inner() {
            unsafe {
                ShowWindow(hwnd, SW_HIDE);
            }
        } else {
            unsafe {
                ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                UpdateWindow(hwnd);
            }
        }
    }

    fn drain_commands(hwnd: HWND) {
        let shared = shared();
        let Some(app) = shared.app.lock().ok().and_then(|guard| guard.clone()) else {
            return;
        };

        loop {
            let command = {
                let mut queue = match shared.queue.lock() {
                    Ok(queue) => queue,
                    Err(_) => return,
                };
                queue.pop_front()
            };
            match command {
                Some(NativeTaskbarCommand::ApplyConfig(config)) => {
                    if let Ok(mut slot) = shared.config.lock() {
                        *slot = Some(config.clone());
                    }
                    let model = shared.model.lock().ok().map(|guard| guard.clone()).unwrap_or_default();
                    apply_window_frame(hwnd, &config, &model);
                    unsafe {
                        InvalidateRect(hwnd, ptr::null(), 1);
                    }
                }
                Some(NativeTaskbarCommand::UpdateSnapshot(snapshot)) => {
                    let config = shared.config.lock().ok().and_then(|guard| guard.clone());
                    if let Some(config) = config {
                        let model = build_model(&snapshot, &config);
                        if let Ok(mut slot) = shared.model.lock() {
                            *slot = model.clone();
                        }
                        apply_window_frame(hwnd, &config, &model);
                        unsafe {
                            InvalidateRect(hwnd, ptr::null(), 1);
                        }
                    }
                }
                Some(NativeTaskbarCommand::Close) => unsafe {
                    DestroyWindow(hwnd);
                    break;
                },
                None => break,
            }
        }

        let _ = app;
    }

    fn show_context_menu(hwnd: HWND) {
        let shared = shared();
        let Some(app) = shared.app.lock().ok().and_then(|guard| guard.clone()) else {
            return;
        };

        let main_visible = app
            .get_webview_window("main")
            .and_then(|win| win.is_visible().ok())
            .unwrap_or(false);

        let menu = unsafe { CreatePopupMenu() };
        if menu.is_null() {
            return;
        }

        let toggle_text = if main_visible {
            "Hide Main Window"
        } else {
            "Show Main Window"
        };
        let toggle_text_w = to_wide(toggle_text);
        let exit_text_w = to_wide("Exit App");
        unsafe {
            AppendMenuW(menu, MF_STRING, MENU_SHOW_OR_HIDE_MAIN, toggle_text_w.as_ptr());
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(menu, MF_STRING, MENU_EXIT_APP, exit_text_w.as_ptr());
        }

        let mut cursor = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
        unsafe {
            GetCursorPos(&mut cursor);
        }
        let selected = unsafe {
            TrackPopupMenu(
                menu,
                TPM_LEFTALIGN | TPM_RIGHTBUTTON | TPM_RETURNCMD,
                cursor.x,
                cursor.y,
                0,
                hwnd,
                ptr::null(),
            )
        };

        match selected as usize {
            MENU_SHOW_OR_HIDE_MAIN => toggle_main_window(&app, &shared),
            MENU_EXIT_APP => app.exit(0),
            _ => {}
        }

        unsafe {
            DestroyMenu(menu);
        }
    }

    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_APPLY_COMMANDS => {
                drain_commands(hwnd);
                0
            }
            WM_NCHITTEST => HTCAPTION as LRESULT,
            WM_LBUTTONDBLCLK => {
                let shared = shared();
                if let Some(app) = shared.app.lock().ok().and_then(|guard| guard.clone()) {
                    show_or_create_main_window(&app, &shared);
                }
                0
            }
            WM_RBUTTONUP => {
                show_context_menu(hwnd);
                0
            }
            WM_PAINT => {
                let shared = shared();
                let config = shared.config.lock().ok().and_then(|guard| guard.clone());
                let model = shared.model.lock().ok().map(|guard| guard.clone()).unwrap_or_default();
                let mut ps: PAINTSTRUCT = std::mem::zeroed();
                let hdc = BeginPaint(hwnd, &mut ps as *mut PAINTSTRUCT);
                if !hdc.is_null() {
                    let fallback = NativeTaskbarConfig {
                        language: "en-US".to_string(),
                        always_on_top: true,
                        auto_hide_on_fullscreen: false,
                        show_cpu: true,
                        show_cpu_freq: true,
                        show_cpu_temp: true,
                        show_gpu: true,
                        show_gpu_temp: true,
                        show_memory: true,
                        show_app: true,
                        show_down: true,
                        show_up: true,
                        show_latency: false,
                        two_line_mode: false,
                        background_mode: "dark".to_string(),
                    };
                    let config = config.unwrap_or(fallback);
                    let (bg, fg, _) = config_colors(&config);
                    let brush = CreateSolidBrush(bg);
                    let mut rect: RECT = std::mem::zeroed();
                    GetClientRect(hwnd, &mut rect as *mut RECT);
                    FillRect(hdc, &rect as *const RECT, brush);
                    SetBkMode(hdc, TRANSPARENT as i32);
                    SetTextColor(hdc, fg);
                    let font = GetStockObject(DEFAULT_GUI_FONT);
                    SelectObject(hdc, font);

                    let mut line1_rect = RECT {
                        left: 10,
                        top: 4,
                        right: rect.right - 10,
                        bottom: if config.two_line_mode || !model.line2.is_empty() { 24 } else { rect.bottom - 4 },
                    };
                    let line1 = to_wide(&model.line1);
                    DrawTextW(
                        hdc,
                        line1.as_ptr(),
                        -1,
                        &mut line1_rect as *mut RECT,
                        DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX | DT_END_ELLIPSIS,
                    );

                    if config.two_line_mode || !model.line2.is_empty() {
                        let mut line2_rect = RECT {
                            left: 10,
                            top: 22,
                            right: rect.right - 10,
                            bottom: rect.bottom - 4,
                        };
                        let line2 = to_wide(&model.line2);
                        DrawTextW(
                            hdc,
                            line2.as_ptr(),
                            -1,
                            &mut line2_rect as *mut RECT,
                            DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX | DT_END_ELLIPSIS,
                        );
                    }

                    DeleteObject(brush);
                }
                EndPaint(hwnd, &ps as *const PAINTSTRUCT);
                0
            }
            WM_DESTROY => {
                let shared = shared();
                shared.set_hwnd(ptr::null_mut());
                shared.running.store(false, Ordering::Relaxed);
                PostQuitMessage(0);
                0
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    fn ensure_thread() {
        let shared = shared();
        if shared.running.swap(true, Ordering::SeqCst) {
            return;
        }
        thread::spawn(move || {
            let class_name = to_wide(CLASS_NAME);
            let title = to_wide(WINDOW_TITLE);
            let hinstance = unsafe { windows_sys::Win32::System::LibraryLoader::GetModuleHandleW(ptr::null()) }
                as HINSTANCE;
            let wnd_class = WNDCLASSW {
                style: CS_DBLCLKS,
                lpfnWndProc: Some(window_proc),
                hInstance: hinstance,
                lpszClassName: class_name.as_ptr(),
                hCursor: unsafe { LoadCursorW(ptr::null_mut(), IDC_ARROW) },
                ..unsafe { std::mem::zeroed() }
            };

            unsafe {
                RegisterClassW(&wnd_class as *const WNDCLASSW);
            }

            let hwnd = unsafe {
                CreateWindowExW(
                    WS_EX_TOOLWINDOW | WS_EX_LAYERED | WS_EX_TOPMOST,
                    class_name.as_ptr(),
                    title.as_ptr(),
                    WS_POPUP,
                    CW_USEDEFAULT,
                    CW_USEDEFAULT,
                    640,
                    28,
                    ptr::null_mut(),
                    ptr::null_mut() as HMENU,
                    hinstance,
                    ptr::null(),
                )
            };

            if hwnd.is_null() {
                shared.running.store(false, Ordering::Relaxed);
                tracing::warn!("failed to create native taskbar window");
                return;
            }

            shared.set_hwnd(hwnd);
            unsafe {
                SetLayeredWindowAttributes(hwnd, 0, 240, LWA_ALPHA);
                ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                UpdateWindow(hwnd);
                PostMessageW(hwnd, WM_APPLY_COMMANDS, 0, 0);
            }

            let mut msg: MSG = unsafe { std::mem::zeroed() };
            loop {
                let result = unsafe { GetMessageW(&mut msg as *mut MSG, ptr::null_mut(), 0, 0) };
                if result <= 0 {
                    break;
                }
                unsafe {
                    TranslateMessage(&msg as *const MSG);
                    DispatchMessageW(&msg as *const MSG);
                }
            }
            thread::sleep(Duration::from_millis(10));
            shared.set_hwnd(ptr::null_mut());
            shared.running.store(false, Ordering::Relaxed);
        });
    }

    pub async fn configure(
        app: AppHandle,
        state: SharedState,
        enabled: bool,
        config: NativeTaskbarConfig,
    ) -> Result<(), String> {
        state.settings.write().await.native_taskbar_monitor_enabled = enabled;
        let shared = shared();
        if let Ok(mut slot) = shared.app.lock() {
            *slot = Some(app);
        }
        if let Ok(mut slot) = shared.state.lock() {
            *slot = Some(state.clone());
        }
        if enabled {
            retain_pending_commands(|command| !matches!(command, NativeTaskbarCommand::Close));
            ensure_thread();
            push_command(NativeTaskbarCommand::ApplyConfig(config));
            let snapshot = state.latest_snapshot.read().await.clone();
            push_command(NativeTaskbarCommand::UpdateSnapshot(snapshot));
        } else {
            let has_window = !shared.hwnd().is_null();
            if shared.running.load(Ordering::Relaxed) || has_window {
                retain_pending_commands(|command| !matches!(command, NativeTaskbarCommand::Close));
                push_command(NativeTaskbarCommand::Close);
            } else {
                retain_pending_commands(|command| !matches!(command, NativeTaskbarCommand::Close));
            }
        }
        Ok(())
    }

    pub fn refresh(snapshot: TelemetrySnapshot) {
        let shared = shared();
        if !shared.running.load(Ordering::Relaxed) {
            return;
        }
        push_command(NativeTaskbarCommand::UpdateSnapshot(snapshot));
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    use tauri::AppHandle;

    pub async fn configure(
        _app: AppHandle,
        _state: SharedState,
        _enabled: bool,
        _config: NativeTaskbarConfig,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn refresh(_snapshot: TelemetrySnapshot) {}
}

pub async fn configure(
    app: tauri::AppHandle,
    state: SharedState,
    enabled: bool,
    config: NativeTaskbarConfig,
) -> Result<(), String> {
    imp::configure(app, state, enabled, config).await
}

pub fn refresh(snapshot: TelemetrySnapshot) {
    imp::refresh(snapshot)
}
