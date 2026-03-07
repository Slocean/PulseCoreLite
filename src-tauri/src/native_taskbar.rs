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

    use serde::Serialize;
    use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
    use windows_sys::Win32::{
        Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, RECT, SIZE, WPARAM},
        Graphics::Gdi::{
            BeginPaint, CreateSolidBrush, DEFAULT_GUI_FONT, DeleteObject, EndPaint, FillRect,
            GetStockObject, GetTextExtentPoint32W, PAINTSTRUCT, SelectObject, SetBkMode,
            SetTextColor, TextOutW, ANSI_FIXED_FONT, TRANSPARENT,
        },
        UI::{
            Shell::{ABM_GETTASKBARPOS, APPBARDATA, SHAppBarMessage},
            WindowsAndMessaging::{
                AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu,
                DestroyWindow, DispatchMessageW, GetCursorPos, GetMessageW, LoadCursorW,
                PostMessageW, PostQuitMessage, RegisterClassW, SetLayeredWindowAttributes,
                SetWindowPos, ShowWindow, TrackPopupMenu, TranslateMessage, CS_DBLCLKS,
                CW_USEDEFAULT, HMENU, HTCAPTION, HWND_NOTOPMOST, HWND_TOPMOST, IDC_ARROW,
                LWA_ALPHA, MF_CHECKED, MF_SEPARATOR, MF_STRING, MF_UNCHECKED, MSG, SW_HIDE,
                SW_SHOWNOACTIVATE, SWP_NOACTIVATE, TPM_LEFTALIGN, TPM_RETURNCMD,
                TPM_RIGHTBUTTON, WM_APP, WM_DESTROY, WM_EXITSIZEMOVE, WM_LBUTTONDBLCLK,
                WM_MOVE, WM_NCHITTEST, WM_PAINT, WM_RBUTTONUP, WNDCLASSW, WS_EX_LAYERED,
                WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
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
    const MENU_ALWAYS_ON_TOP: usize = 1002;
    const MENU_AUTO_HIDE_FULLSCREEN: usize = 1003;
    const MENU_REMEMBER_POSITION: usize = 1004;
    const MENU_POSITION_LOCK: usize = 1005;
    const MENU_TWO_LINE: usize = 1006;
    const MENU_THEME_TRANSPARENT: usize = 1007;
    const MENU_THEME_DARK: usize = 1008;
    const MENU_THEME_LIGHT: usize = 1009;
    const MENU_SHOW_CPU: usize = 1010;
    const MENU_SHOW_GPU: usize = 1011;
    const MENU_SHOW_MEMORY: usize = 1012;
    const MENU_SHOW_APP: usize = 1013;
    const MENU_SHOW_DOWN: usize = 1014;
    const MENU_SHOW_UP: usize = 1015;
    const MENU_SHOW_CPU_FREQ: usize = 1016;
    const MENU_SHOW_CPU_TEMP: usize = 1017;
    const MENU_SHOW_GPU_TEMP: usize = 1018;
    const MENU_SHOW_LATENCY: usize = 1019;
    const MENU_CLOSE_TASKBAR: usize = 1020;
    const MENU_EXIT_APP: usize = 1021;

    #[derive(Clone)]
    enum NativeTaskbarCommand {
        ApplyConfig(NativeTaskbarConfig),
        UpdateSnapshot(TelemetrySnapshot),
        Close,
    }

    #[derive(Clone, Copy)]
    enum SegmentTone {
        Normal,
        Muted,
        Cyan,
        Pink,
        Orange,
        Red,
    }

    #[derive(Clone, Default)]
    struct NativeTaskbarSegment {
        label: String,
        value: String,
        extra: Option<String>,
        value_tone: SegmentTone,
    }

    #[derive(Clone, Default)]
    struct NativeTaskbarModel {
        rows: Vec<Vec<NativeTaskbarSegment>>,
    }

    struct NativeTaskbarShared {
        hwnd: AtomicIsize,
        running: AtomicBool,
        queue: Mutex<VecDeque<NativeTaskbarCommand>>,
        app: Mutex<Option<AppHandle>>,
        state: Mutex<Option<SharedState>>,
        config: Mutex<Option<NativeTaskbarConfig>>,
        model: Mutex<NativeTaskbarModel>,
        manual_position: Mutex<Option<(i32, i32)>>,
        locked_position: Mutex<Option<(i32, i32)>>,
        programmatic_move: AtomicBool,
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
                manual_position: Mutex::new(None),
                locked_position: Mutex::new(None),
                programmatic_move: AtomicBool::new(false),
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

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct NativeTaskbarSyncSettings {
        taskbar_always_on_top: bool,
        taskbar_auto_hide_on_fullscreen: bool,
        remember_overlay_position: bool,
        taskbar_position_locked: bool,
        native_taskbar_monitor_enabled: bool,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct NativeTaskbarSyncPrefs {
        show_cpu: bool,
        show_cpu_freq: bool,
        show_cpu_temp: bool,
        show_gpu: bool,
        show_gpu_temp: bool,
        show_memory: bool,
        show_app: bool,
        show_down: bool,
        show_up: bool,
        show_latency: bool,
        two_line_mode: bool,
        background_mode: String,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct NativeTaskbarSyncPayload {
        settings: NativeTaskbarSyncSettings,
        prefs: NativeTaskbarSyncPrefs,
    }

    struct MenuText {
        show_main_window: &'static str,
        hide_main_window: &'static str,
        always_on_top: &'static str,
        auto_hide_on_fullscreen: &'static str,
        remember_position: &'static str,
        lock_position: &'static str,
        unlock_position: &'static str,
        two_line: &'static str,
        theme_transparent: &'static str,
        theme_dark: &'static str,
        theme_light: &'static str,
        cpu: &'static str,
        cpu_freq: &'static str,
        cpu_temp: &'static str,
        gpu: &'static str,
        gpu_temp: &'static str,
        memory: &'static str,
        app: &'static str,
        down: &'static str,
        up: &'static str,
        latency: &'static str,
        close_taskbar: &'static str,
        exit_app: &'static str,
    }

    fn menu_text(language: &str) -> MenuText {
        if language == "zh-CN" {
            MenuText {
                show_main_window: "显示主窗口",
                hide_main_window: "隐藏主窗口",
                always_on_top: "常驻置顶",
                auto_hide_on_fullscreen: "全屏时自动隐藏",
                remember_position: "记住位置",
                lock_position: "锁定任务栏位置",
                unlock_position: "解除任务栏位置锁定",
                two_line: "双行显示",
                theme_transparent: "透明主题",
                theme_dark: "暗色主题",
                theme_light: "亮色主题",
                cpu: "CPU",
                cpu_freq: "CPU 频率",
                cpu_temp: "CPU 温度",
                gpu: "GPU",
                gpu_temp: "GPU 温度",
                memory: "内存",
                app: "APP",
                down: "下行",
                up: "上行",
                latency: "延迟",
                close_taskbar: "关闭任务栏监控",
                exit_app: "退出",
            }
        } else {
            MenuText {
                show_main_window: "Show Main Window",
                hide_main_window: "Hide Main Window",
                always_on_top: "Always On Top",
                auto_hide_on_fullscreen: "Auto Hide In Fullscreen",
                remember_position: "Remember Position",
                lock_position: "Lock Taskbar Position",
                unlock_position: "Unlock Taskbar Position",
                two_line: "Two-line Mode",
                theme_transparent: "Transparent Theme",
                theme_dark: "Dark Theme",
                theme_light: "Light Theme",
                cpu: "CPU",
                cpu_freq: "CPU Frequency",
                cpu_temp: "CPU Temperature",
                gpu: "GPU",
                gpu_temp: "GPU Temperature",
                memory: "Memory",
                app: "APP",
                down: "Down",
                up: "Up",
                latency: "Latency",
                close_taskbar: "Close Taskbar Monitor",
                exit_app: "Exit",
            }
        }
    }

    impl Default for SegmentTone {
        fn default() -> Self {
            Self::Normal
        }
    }

    fn usage_tone(value: f64, gpu: bool) -> SegmentTone {
        if value >= 90.0 {
            SegmentTone::Red
        } else if value >= 75.0 {
            SegmentTone::Orange
        } else if gpu {
            SegmentTone::Pink
        } else {
            SegmentTone::Cyan
        }
    }

    fn get_window_rect(hwnd: HWND) -> Option<RECT> {
        let mut rect: RECT = unsafe { std::mem::zeroed() };
        if unsafe { windows_sys::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rect) } == 0 {
            return None;
        }
        Some(rect)
    }

    fn capture_current_position(shared: &NativeTaskbarShared, hwnd: HWND) {
        let Some(rect) = get_window_rect(hwnd) else {
            return;
        };
        let next = (rect.left, rect.top);
        if let Ok(mut slot) = shared.manual_position.lock() {
            *slot = Some(next);
        }
        let locked = with_state_settings(shared, |settings| settings.taskbar_position_locked).unwrap_or(false);
        if locked {
            if let Ok(mut slot) = shared.locked_position.lock() {
                *slot = Some(next);
            }
        }
    }

    fn sync_payload(shared: &NativeTaskbarShared, config: &NativeTaskbarConfig, enabled: bool) -> NativeTaskbarSyncPayload {
        let settings = with_state_settings(shared, |settings| NativeTaskbarSyncSettings {
            taskbar_always_on_top: settings.taskbar_always_on_top,
            taskbar_auto_hide_on_fullscreen: settings.taskbar_auto_hide_on_fullscreen,
            remember_overlay_position: settings.remember_overlay_position,
            taskbar_position_locked: settings.taskbar_position_locked,
            native_taskbar_monitor_enabled: enabled,
        })
        .unwrap_or(NativeTaskbarSyncSettings {
            taskbar_always_on_top: config.always_on_top,
            taskbar_auto_hide_on_fullscreen: config.auto_hide_on_fullscreen,
            remember_overlay_position: config.remember_position,
            taskbar_position_locked: config.position_locked,
            native_taskbar_monitor_enabled: enabled,
        });
        NativeTaskbarSyncPayload {
            settings,
            prefs: NativeTaskbarSyncPrefs {
                show_cpu: config.show_cpu,
                show_cpu_freq: config.show_cpu_freq,
                show_cpu_temp: config.show_cpu_temp,
                show_gpu: config.show_gpu,
                show_gpu_temp: config.show_gpu_temp,
                show_memory: config.show_memory,
                show_app: config.show_app,
                show_down: config.show_down,
                show_up: config.show_up,
                show_latency: config.show_latency,
                two_line_mode: config.two_line_mode,
                background_mode: config.background_mode.clone(),
            },
        }
    }

    fn emit_native_taskbar_sync(shared: &NativeTaskbarShared, config: &NativeTaskbarConfig, enabled: bool) {
        let Some(app) = shared.app.lock().ok().and_then(|guard| guard.clone()) else {
            return;
        };
        let payload = sync_payload(shared, config, enabled);
        for label in ["main", "taskbar", "toolkit"] {
            let _ = app.emit_to(label, "pulsecorelite://native-taskbar-sync", payload.clone());
        }
    }

    fn with_config_mut<T>(shared: &NativeTaskbarShared, map: impl FnOnce(&mut NativeTaskbarConfig) -> T) -> Option<T> {
        let mut guard = shared.config.lock().ok()?;
        let config = guard.as_mut()?;
        Some(map(config))
    }

    fn refresh_from_latest_snapshot(shared: &NativeTaskbarShared) {
        let Some(state) = shared.state.lock().ok().and_then(|guard| guard.clone()) else {
            return;
        };
        let snapshot = tauri::async_runtime::block_on(async { state.latest_snapshot.read().await.clone() });
        push_command(NativeTaskbarCommand::UpdateSnapshot(snapshot));
    }

    fn apply_runtime_config_change(shared: &NativeTaskbarShared, updater: impl FnOnce(&mut NativeTaskbarConfig)) {
        let next_config = with_config_mut(shared, |config| {
            updater(config);
            config.clone()
        });
        let Some(config) = next_config else {
            return;
        };
        emit_native_taskbar_sync(shared, &config, true);
        push_command(NativeTaskbarCommand::ApplyConfig(config));
        refresh_from_latest_snapshot(shared);
    }

    fn update_settings(shared: &NativeTaskbarShared, updater: impl FnOnce(&mut AppSettings)) {
        let Some(state) = shared.state.lock().ok().and_then(|guard| guard.clone()) else {
            return;
        };
        tauri::async_runtime::block_on(async {
            let mut settings = state.settings.write().await;
            updater(&mut settings);
        });
    }

    fn build_segments(snapshot: &TelemetrySnapshot, config: &NativeTaskbarConfig) -> Vec<NativeTaskbarSegment> {
        let mut parts = Vec::new();
        if config.show_cpu {
            let mut extras = Vec::new();
            if config.show_cpu_freq {
                if let Some(freq) = snapshot.cpu.frequency_mhz {
                    extras.push(format!("{}MHz", freq));
                }
            }
            if config.show_cpu_temp {
                if let Some(temp) = snapshot.cpu.temperature_c {
                    extras.push(format!("{:.0}°C", temp));
                }
            }
            parts.push(NativeTaskbarSegment {
                label: "CPU".to_string(),
                value: format!("{:.0}%", snapshot.cpu.usage_pct),
                extra: (!extras.is_empty()).then(|| extras.join(" ")),
                value_tone: usage_tone(snapshot.cpu.usage_pct, false),
            });
        }
        if config.show_gpu {
            let usage = snapshot.gpu.usage_pct.unwrap_or(0.0);
            let mut extras = Vec::new();
            if config.show_gpu_temp {
                if let Some(temp) = snapshot.gpu.temperature_c {
                    extras.push(format!("{:.0}°C", temp));
                }
            }
            parts.push(NativeTaskbarSegment {
                label: "GPU".to_string(),
                value: format!("{:.0}%", usage),
                extra: (!extras.is_empty()).then(|| extras.join(" ")),
                value_tone: usage_tone(usage, true),
            });
        }
        if config.show_memory {
            parts.push(NativeTaskbarSegment {
                label: "RAM".to_string(),
                value: format!("{:.0}%", snapshot.memory.usage_pct),
                extra: None,
                value_tone: usage_tone(snapshot.memory.usage_pct, false),
            });
        }
        if config.show_app {
            parts.push(NativeTaskbarSegment {
                label: "APP".to_string(),
                value: format!("{:.1}%", snapshot.app_cpu_usage_pct.unwrap_or(0.0)),
                extra: snapshot.app_memory_mb.map(|mem| format!("{:.0}MB", mem)),
                value_tone: SegmentTone::Cyan,
            });
        }
        if config.show_down {
            parts.push(NativeTaskbarSegment {
                label: "↓".to_string(),
                value: format_speed(snapshot.network.download_bytes_per_sec),
                extra: None,
                value_tone: SegmentTone::Normal,
            });
        }
        if config.show_up {
            parts.push(NativeTaskbarSegment {
                label: "↑".to_string(),
                value: format_speed(snapshot.network.upload_bytes_per_sec),
                extra: None,
                value_tone: SegmentTone::Normal,
            });
        }
        if config.show_latency {
            parts.push(NativeTaskbarSegment {
                label: if config.language == "zh-CN" { "延迟" } else { "LAT" }.to_string(),
                value: format_latency(snapshot.network.latency_ms, &config.language),
                extra: None,
                value_tone: SegmentTone::Normal,
            });
        }
        if parts.is_empty() {
            parts.push(NativeTaskbarSegment {
                label: "PulseCoreLite".to_string(),
                value: String::new(),
                extra: None,
                value_tone: SegmentTone::Muted,
            });
        }
        parts
    }

    fn build_model(snapshot: &TelemetrySnapshot, config: &NativeTaskbarConfig) -> NativeTaskbarModel {
        let parts = build_segments(snapshot, config);
        if config.two_line_mode {
            let split = ((parts.len() as f64) / 2.0).ceil() as usize;
            let (top, bottom) = parts.split_at(split.max(1).min(parts.len()));
            NativeTaskbarModel {
                rows: vec![top.to_vec(), bottom.to_vec()],
            }
        } else {
            NativeTaskbarModel {
                rows: vec![parts],
            }
        }
    }

    fn estimate_model_width(model: &NativeTaskbarModel, config: &NativeTaskbarConfig) -> i32 {
        let chars = model
            .rows
            .iter()
            .map(|row| {
                row.iter()
                    .map(|segment| {
                        segment.label.len()
                            + 1
                            + segment.value.len()
                            + segment.extra.as_ref().map(|extra| 1 + extra.len()).unwrap_or(0)
                    })
                    .sum::<usize>()
                    + row.len().saturating_sub(1) * 3
            })
            .max()
            .unwrap_or(28) as i32;
        let per_char = if config.two_line_mode { 8 } else { 9 };
        (chars * per_char + 28).clamp(240, 1080)
    }

    fn tone_color(config: &NativeTaskbarConfig, tone: SegmentTone) -> COLORREF {
        match tone {
            SegmentTone::Muted => match config.background_mode.as_str() {
                "light" => rgb(60, 68, 78),
                _ => rgb(208, 214, 222),
            },
            SegmentTone::Cyan => rgb(0, 242, 255),
            SegmentTone::Pink => rgb(188, 19, 254),
            SegmentTone::Orange => rgb(255, 165, 0),
            SegmentTone::Red => rgb(255, 59, 59),
            SegmentTone::Normal => match config.background_mode.as_str() {
                "light" => rgb(24, 29, 38),
                _ => rgb(240, 243, 246),
            },
        }
    }

    fn measure_text(hdc: *mut core::ffi::c_void, text: &str) -> i32 {
        if text.is_empty() {
            return 0;
        }
        let wide = to_wide(text);
        let mut size = SIZE { cx: 0, cy: 0 };
        unsafe {
            GetTextExtentPoint32W(hdc, wide.as_ptr(), (wide.len() - 1) as i32, &mut size as *mut SIZE);
        }
        size.cx
    }

    fn draw_text_piece(
        hdc: *mut core::ffi::c_void,
        x: &mut i32,
        y: i32,
        text: &str,
        color: COLORREF,
        font: *mut core::ffi::c_void,
    ) {
        if text.is_empty() {
            return;
        }
        let wide = to_wide(text);
        unsafe {
            SelectObject(hdc, font);
            SetTextColor(hdc, color);
            TextOutW(hdc, *x, y, wide.as_ptr(), (wide.len() - 1) as i32);
        }
        *x += measure_text(hdc, text);
    }

    fn draw_row(
        hdc: *mut core::ffi::c_void,
        config: &NativeTaskbarConfig,
        row: &[NativeTaskbarSegment],
        top: i32,
    ) {
        let label_font = unsafe { GetStockObject(DEFAULT_GUI_FONT) };
        let value_font = unsafe { GetStockObject(ANSI_FIXED_FONT) };
        let label_color = tone_color(config, SegmentTone::Muted);
        let sep_color = match config.background_mode.as_str() {
            "light" => rgb(120, 128, 138),
            _ => rgb(150, 158, 168),
        };
        let extra_color = tone_color(config, SegmentTone::Muted);
        let mut x = 10;

        for (index, segment) in row.iter().enumerate() {
            if index > 0 {
                draw_text_piece(hdc, &mut x, top, " | ", sep_color, label_font);
            }
            draw_text_piece(hdc, &mut x, top, &segment.label, label_color, label_font);
            if !segment.value.is_empty() {
                draw_text_piece(hdc, &mut x, top, " ", label_color, label_font);
                draw_text_piece(hdc, &mut x, top, &segment.value, tone_color(config, segment.value_tone), value_font);
            }
            if let Some(extra) = &segment.extra {
                draw_text_piece(hdc, &mut x, top, " ", extra_color, label_font);
                draw_text_piece(hdc, &mut x, top, extra, extra_color, value_font);
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

    fn hide_main_window(app: &AppHandle) {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.hide();
        }
    }

    fn toggle_main_window(app: &AppHandle, shared: &NativeTaskbarShared) {
        if let Some(win) = app.get_webview_window("main") {
            if win.is_visible().unwrap_or(false) {
                hide_main_window(app);
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
        let width = estimate_model_width(model, config);
        let height = if config.two_line_mode || model.rows.len() > 1 { 48 } else { 28 };
        let shared = shared();
        let locked_position = shared.locked_position.lock().ok().and_then(|guard| *guard);
        let manual_position = shared.manual_position.lock().ok().and_then(|guard| *guard);
        let (mut x, mut y) = if config.position_locked {
            locked_position.or(manual_position).unwrap_or((CW_USEDEFAULT, CW_USEDEFAULT))
        } else if config.remember_position {
            manual_position.unwrap_or((CW_USEDEFAULT, CW_USEDEFAULT))
        } else {
            (CW_USEDEFAULT, CW_USEDEFAULT)
        };
        if let Some(info) = taskbar_info {
            if x == CW_USEDEFAULT || y == CW_USEDEFAULT {
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
        }

        let insert_after = if config.always_on_top { HWND_TOPMOST } else { HWND_NOTOPMOST };
        shared.programmatic_move.store(true, Ordering::Relaxed);
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
        shared.programmatic_move.store(false, Ordering::Relaxed);
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
        let config = shared.config.lock().ok().and_then(|guard| guard.clone());
        let Some(config) = config else {
            return;
        };
        let text = menu_text(&config.language);

        let main_visible = app
            .get_webview_window("main")
            .and_then(|win| win.is_visible().ok())
            .unwrap_or(false);

        let menu = unsafe { CreatePopupMenu() };
        if menu.is_null() {
            return;
        }

        let toggle_text = if main_visible { text.hide_main_window } else { text.show_main_window };
        let toggle_text_w = to_wide(toggle_text);
        let always_on_top_text = to_wide(text.always_on_top);
        let auto_hide_text = to_wide(text.auto_hide_on_fullscreen);
        let remember_position_text = to_wide(text.remember_position);
        let position_lock_text = to_wide(if config.position_locked {
            text.unlock_position
        } else {
            text.lock_position
        });
        let two_line_text = to_wide(text.two_line);
        let theme_transparent_text = to_wide(text.theme_transparent);
        let theme_dark_text = to_wide(text.theme_dark);
        let theme_light_text = to_wide(text.theme_light);
        let cpu_text = to_wide(text.cpu);
        let cpu_freq_text = to_wide(text.cpu_freq);
        let cpu_temp_text = to_wide(text.cpu_temp);
        let gpu_text = to_wide(text.gpu);
        let gpu_temp_text = to_wide(text.gpu_temp);
        let memory_text = to_wide(text.memory);
        let app_text = to_wide(text.app);
        let down_text = to_wide(text.down);
        let up_text = to_wide(text.up);
        let latency_text = to_wide(text.latency);
        let close_taskbar_text = to_wide(text.close_taskbar);
        let exit_text_w = to_wide(text.exit_app);
        unsafe {
            AppendMenuW(menu, MF_STRING, MENU_SHOW_OR_HIDE_MAIN, toggle_text_w.as_ptr());
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(
                menu,
                MF_STRING | if config.always_on_top { MF_CHECKED } else { MF_UNCHECKED },
                MENU_ALWAYS_ON_TOP,
                always_on_top_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.auto_hide_on_fullscreen { MF_CHECKED } else { MF_UNCHECKED },
                MENU_AUTO_HIDE_FULLSCREEN,
                auto_hide_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.remember_position { MF_CHECKED } else { MF_UNCHECKED },
                MENU_REMEMBER_POSITION,
                remember_position_text.as_ptr(),
            );
            AppendMenuW(menu, MF_STRING, MENU_POSITION_LOCK, position_lock_text.as_ptr());
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(
                menu,
                MF_STRING | if config.two_line_mode { MF_CHECKED } else { MF_UNCHECKED },
                MENU_TWO_LINE,
                two_line_text.as_ptr(),
            );
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(
                menu,
                MF_STRING | if config.background_mode == "transparent" { MF_CHECKED } else { MF_UNCHECKED },
                MENU_THEME_TRANSPARENT,
                theme_transparent_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.background_mode == "dark" { MF_CHECKED } else { MF_UNCHECKED },
                MENU_THEME_DARK,
                theme_dark_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.background_mode == "light" { MF_CHECKED } else { MF_UNCHECKED },
                MENU_THEME_LIGHT,
                theme_light_text.as_ptr(),
            );
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(
                menu,
                MF_STRING | if config.show_cpu { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_CPU,
                cpu_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_cpu_freq { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_CPU_FREQ,
                cpu_freq_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_cpu_temp { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_CPU_TEMP,
                cpu_temp_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_gpu { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_GPU,
                gpu_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_gpu_temp { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_GPU_TEMP,
                gpu_temp_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_memory { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_MEMORY,
                memory_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_app { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_APP,
                app_text.as_ptr(),
            );
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(
                menu,
                MF_STRING | if config.show_down { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_DOWN,
                down_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_up { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_UP,
                up_text.as_ptr(),
            );
            AppendMenuW(
                menu,
                MF_STRING | if config.show_latency { MF_CHECKED } else { MF_UNCHECKED },
                MENU_SHOW_LATENCY,
                latency_text.as_ptr(),
            );
            AppendMenuW(menu, MF_SEPARATOR, 0, ptr::null());
            AppendMenuW(menu, MF_STRING, MENU_CLOSE_TASKBAR, close_taskbar_text.as_ptr());
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
            MENU_ALWAYS_ON_TOP => {
                update_settings(&shared, |settings| {
                    settings.taskbar_always_on_top = !settings.taskbar_always_on_top;
                });
                apply_runtime_config_change(&shared, |config| {
                    config.always_on_top = !config.always_on_top;
                });
            }
            MENU_AUTO_HIDE_FULLSCREEN => {
                update_settings(&shared, |settings| {
                    settings.taskbar_auto_hide_on_fullscreen = !settings.taskbar_auto_hide_on_fullscreen;
                });
                apply_runtime_config_change(&shared, |config| {
                    config.auto_hide_on_fullscreen = !config.auto_hide_on_fullscreen;
                });
            }
            MENU_REMEMBER_POSITION => {
                let enabled = !config.remember_position;
                update_settings(&shared, |settings| {
                    settings.remember_overlay_position = enabled;
                });
                if enabled {
                    capture_current_position(&shared, hwnd);
                } else if !config.position_locked {
                    if let Ok(mut slot) = shared.manual_position.lock() {
                        *slot = None;
                    }
                }
                apply_runtime_config_change(&shared, |config| {
                    config.remember_position = enabled;
                });
            }
            MENU_POSITION_LOCK => {
                let enabled = !config.position_locked;
                update_settings(&shared, |settings| {
                    settings.taskbar_position_locked = enabled;
                });
                if enabled {
                    capture_current_position(&shared, hwnd);
                } else if let Ok(mut slot) = shared.locked_position.lock() {
                    *slot = None;
                }
                apply_runtime_config_change(&shared, |config| {
                    config.position_locked = enabled;
                });
            }
            MENU_TWO_LINE => apply_runtime_config_change(&shared, |config| {
                config.two_line_mode = !config.two_line_mode;
            }),
            MENU_THEME_TRANSPARENT => apply_runtime_config_change(&shared, |config| {
                config.background_mode = "transparent".to_string();
            }),
            MENU_THEME_DARK => apply_runtime_config_change(&shared, |config| {
                config.background_mode = "dark".to_string();
            }),
            MENU_THEME_LIGHT => apply_runtime_config_change(&shared, |config| {
                config.background_mode = "light".to_string();
            }),
            MENU_SHOW_CPU => apply_runtime_config_change(&shared, |config| {
                config.show_cpu = !config.show_cpu;
            }),
            MENU_SHOW_CPU_FREQ => apply_runtime_config_change(&shared, |config| {
                config.show_cpu_freq = !config.show_cpu_freq;
            }),
            MENU_SHOW_CPU_TEMP => apply_runtime_config_change(&shared, |config| {
                config.show_cpu_temp = !config.show_cpu_temp;
            }),
            MENU_SHOW_GPU => apply_runtime_config_change(&shared, |config| {
                config.show_gpu = !config.show_gpu;
            }),
            MENU_SHOW_GPU_TEMP => apply_runtime_config_change(&shared, |config| {
                config.show_gpu_temp = !config.show_gpu_temp;
            }),
            MENU_SHOW_MEMORY => apply_runtime_config_change(&shared, |config| {
                config.show_memory = !config.show_memory;
            }),
            MENU_SHOW_APP => apply_runtime_config_change(&shared, |config| {
                config.show_app = !config.show_app;
            }),
            MENU_SHOW_DOWN => apply_runtime_config_change(&shared, |config| {
                config.show_down = !config.show_down;
            }),
            MENU_SHOW_UP => apply_runtime_config_change(&shared, |config| {
                config.show_up = !config.show_up;
            }),
            MENU_SHOW_LATENCY => apply_runtime_config_change(&shared, |config| {
                config.show_latency = !config.show_latency;
            }),
            MENU_CLOSE_TASKBAR => {
                update_settings(&shared, |settings| {
                    settings.native_taskbar_monitor_enabled = false;
                });
                emit_native_taskbar_sync(&shared, &config, false);
                push_command(NativeTaskbarCommand::Close);
            }
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
            WM_NCHITTEST => {
                let shared = shared();
                let locked = shared
                    .config
                    .lock()
                    .ok()
                    .and_then(|guard| guard.as_ref().map(|config| config.position_locked))
                    .unwrap_or(false);
                if locked {
                    DefWindowProcW(hwnd, msg, wparam, lparam)
                } else {
                    HTCAPTION as LRESULT
                }
            }
            WM_LBUTTONDBLCLK => {
                let shared = shared();
                if let Some(app) = shared.app.lock().ok().and_then(|guard| guard.clone()) {
                    show_or_create_main_window(&app, &shared);
                }
                0
            }
            WM_MOVE | WM_EXITSIZEMOVE => {
                let shared = shared();
                if !shared.programmatic_move.load(Ordering::Relaxed) {
                    capture_current_position(&shared, hwnd);
                }
                DefWindowProcW(hwnd, msg, wparam, lparam)
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
                        remember_position: true,
                        position_locked: false,
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
                    let (bg, _fg, _) = config_colors(&config);
                    let brush = CreateSolidBrush(bg);
                    let mut rect: RECT = std::mem::zeroed();
                    GetClientRect(hwnd, &mut rect as *mut RECT);
                    FillRect(hdc, &rect as *const RECT, brush);
                    SetBkMode(hdc, TRANSPARENT as i32);
                    let row1 = model.rows.first().cloned().unwrap_or_default();
                    draw_row(hdc, &config, &row1, 6);

                    if config.two_line_mode || model.rows.len() > 1 {
                        let row2 = model.rows.get(1).cloned().unwrap_or_default();
                        draw_row(hdc, &config, &row2, 24);
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
