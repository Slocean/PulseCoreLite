use crate::types::SystemToolsStatus;

type ToolResult<T> = Result<T, String>;

const CONTEXT_MENU_INPROC_KEY: &str =
    "Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32";
const LEGACY_WRONG_CONTEXT_MENU_CLSID_KEY: &str =
    "Software\\Classes\\CLSID\\{86e1f1ea-8689-11cf-16b5-444553540000}";
const CONTEXT_MENU_CLASSIC_REG_TARGET: &str =
    r"HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32";
const CONTEXT_MENU_MODERN_REG_TARGET: &str =
    r"HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";
const WU_AU_POLICY_KEY: &str = "SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU";
const WU_POLICY_KEY: &str = "SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate";
const ACTIVATION_PS_COMMAND: &str = "irm https://get.activated.win | iex";

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn open_registry_key(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
    access: u32,
) -> ToolResult<windows_sys::Win32::System::Registry::HKEY> {
    use windows_sys::Win32::System::Registry::RegOpenKeyExW;

    let mut key: windows_sys::Win32::System::Registry::HKEY = std::ptr::null_mut();
    let path_w = to_wide(path);
    let status = unsafe { RegOpenKeyExW(hive, path_w.as_ptr(), 0, access, &mut key) };
    if status != 0 {
        return Err(format!("open registry key failed: {status}"));
    }
    Ok(key)
}

#[cfg(windows)]
fn reg_query_dword(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
    name: &str,
) -> Option<u32> {
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegQueryValueExW, KEY_READ, REG_DWORD};

    let key = open_registry_key(hive, path, KEY_READ).ok()?;
    let name_w = to_wide(name);
    let mut value_type: u32 = 0;
    let mut data: u32 = 0;
    let mut data_len: u32 = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        RegQueryValueExW(
            key,
            name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            &mut data as *mut u32 as *mut u8,
            &mut data_len,
        )
    };
    unsafe {
        RegCloseKey(key);
    }
    if status != 0 || value_type != REG_DWORD {
        return None;
    }
    Some(data)
}

#[cfg(windows)]
fn reg_key_exists(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
) -> bool {
    use windows_sys::Win32::System::Registry::{RegCloseKey, KEY_READ};

    let Ok(key) = open_registry_key(hive, path, KEY_READ) else {
        return false;
    };
    unsafe {
        RegCloseKey(key);
    }
    true
}

#[cfg(windows)]
fn reg_delete_tree(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
) -> ToolResult<()> {
    use windows_sys::Win32::System::Registry::RegDeleteTreeW;

    let path_w = to_wide(path);
    let status = unsafe { RegDeleteTreeW(hive, path_w.as_ptr()) };
    if status != 0 {
        return Err(format!("delete registry tree failed: {status}"));
    }
    Ok(())
}

#[cfg(windows)]
fn restart_explorer() -> ToolResult<()> {
    use std::{os::windows::process::CommandExt, process::Command, thread, time::Duration};

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = Command::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/f", "/im", "explorer.exe"])
        .status();
    thread::sleep(Duration::from_millis(800));
    Command::new("explorer.exe")
        .spawn()
        .map_err(|err| format!("failed to restart explorer: {err}"))?;
    Ok(())
}

#[cfg(windows)]
fn spawn_elevated_powershell_visible(arguments: &str) -> ToolResult<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOW;

    let operation: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file: Vec<u16> = OsStr::new("powershell.exe")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let params: Vec<u16> = OsStr::new(arguments)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            params.as_ptr(),
            std::ptr::null(),
            SW_SHOW,
        ) as isize
    };
    if result <= 32 {
        return Err(format!("failed to launch elevated powershell: {result}"));
    }
    Ok(())
}

#[cfg(windows)]
fn get_context_menu_style() -> String {
    use windows_sys::Win32::System::Registry::HKEY_CURRENT_USER;

    if reg_key_exists(HKEY_CURRENT_USER, CONTEXT_MENU_INPROC_KEY) {
        "win10".to_string()
    } else {
        "win11".to_string()
    }
}

#[cfg(windows)]
fn is_windows_update_disabled() -> bool {
    use windows_sys::Win32::System::Registry::HKEY_LOCAL_MACHINE;

    let no_auto = reg_query_dword(HKEY_LOCAL_MACHINE, WU_AU_POLICY_KEY, "NoAutoUpdate");
    let disable_access = reg_query_dword(HKEY_LOCAL_MACHINE, WU_POLICY_KEY, "DisableWindowsUpdateAccess");
    matches!(no_auto, Some(1)) || matches!(disable_access, Some(1))
}

#[cfg(windows)]
fn run_hidden_reg(args: &[&str]) -> ToolResult<std::process::Output> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    Command::new("reg.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args(args)
        .output()
        .map_err(|err| format!("failed to run reg.exe: {err}"))
}

#[cfg(windows)]
fn cleanup_legacy_wrong_context_menu_key() {
    use windows_sys::Win32::System::Registry::HKEY_CURRENT_USER;

    if reg_key_exists(HKEY_CURRENT_USER, LEGACY_WRONG_CONTEXT_MENU_CLSID_KEY) {
        let _ = reg_delete_tree(HKEY_CURRENT_USER, LEGACY_WRONG_CONTEXT_MENU_CLSID_KEY);
    }
}

#[cfg(windows)]
fn set_context_menu_style(style: &str) -> ToolResult<()> {
    cleanup_legacy_wrong_context_menu_key();

    let output = match style {
        "win10" => run_hidden_reg(&["add", CONTEXT_MENU_CLASSIC_REG_TARGET, "/f", "/ve"])?,
        "win11" => run_hidden_reg(&["delete", CONTEXT_MENU_MODERN_REG_TARGET, "/f"])?,
        _ => return Err("unsupported context menu style".to_string()),
    };

    if !output.status.success() && style != "win11" {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "reg.exe failed ({:?}): {stdout}{stderr}",
            output.status.code()
        ));
    }

    restart_explorer()
}

#[cfg(windows)]
fn disable_windows_update_permanently() -> ToolResult<()> {
    let script = "$ErrorActionPreference='SilentlyContinue'; New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Force|Out-Null; New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'NoAutoUpdate' -PropertyType DWord -Value 1 -Force|Out-Null; New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'AUOptions' -PropertyType DWord -Value 1 -Force|Out-Null; New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Force|Out-Null; New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'DisableWindowsUpdateAccess' -PropertyType DWord -Value 1 -Force|Out-Null; New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'SetDisableUXWUAccess' -PropertyType DWord -Value 1 -Force|Out-Null; foreach($svc in @('wuauserv','UsoSvc','WaaSMedicSvc')){ Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue; Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue }";
    let args = format!(
        "-NoExit -NoProfile -ExecutionPolicy Bypass -Command \"{script}\""
    );
    spawn_elevated_powershell_visible(&args)
}

#[cfg(windows)]
fn restore_windows_update() -> ToolResult<()> {
    let script = "$ErrorActionPreference='SilentlyContinue'; Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'NoAutoUpdate' -ErrorAction SilentlyContinue; Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'AUOptions' -ErrorAction SilentlyContinue; Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'DisableWindowsUpdateAccess' -ErrorAction SilentlyContinue; Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Name 'SetDisableUXWUAccess' -ErrorAction SilentlyContinue; foreach($svc in @('UsoSvc','WaaSMedicSvc')){ Set-Service -Name $svc -StartupType Manual -ErrorAction SilentlyContinue }; Set-Service -Name wuauserv -StartupType Automatic -ErrorAction SilentlyContinue; Start-Service -Name wuauserv -ErrorAction SilentlyContinue";
    let args = format!(
        "-NoExit -NoProfile -ExecutionPolicy Bypass -Command \"{script}\""
    );
    spawn_elevated_powershell_visible(&args)
}

#[cfg(windows)]
fn run_mas_activation() -> ToolResult<()> {
    let args = format!(
        "-NoExit -NoProfile -ExecutionPolicy Bypass -Command \"{}\"",
        ACTIVATION_PS_COMMAND.replace('"', "\\\"")
    );
    spawn_elevated_powershell_visible(&args)
}

pub fn get_system_tools_status() -> ToolResult<SystemToolsStatus> {
    #[cfg(windows)]
    {
        return Ok(SystemToolsStatus {
            context_menu_style: get_context_menu_style(),
            windows_update_disabled: is_windows_update_disabled(),
        });
    }

    #[cfg(not(windows))]
    {
        Err("System tools are only supported on Windows.".to_string())
    }
}

pub fn apply_context_menu_style(style: String) -> ToolResult<SystemToolsStatus> {
    #[cfg(windows)]
    {
        set_context_menu_style(style.trim())?;
        return get_system_tools_status();
    }

    #[cfg(not(windows))]
    {
        let _ = style;
        Err("System tools are only supported on Windows.".to_string())
    }
}

pub fn disable_windows_update() -> ToolResult<()> {
    #[cfg(windows)]
    {
        return disable_windows_update_permanently();
    }

    #[cfg(not(windows))]
    {
        Err("System tools are only supported on Windows.".to_string())
    }
}

pub fn restore_windows_update_settings() -> ToolResult<()> {
    #[cfg(windows)]
    {
        return restore_windows_update();
    }

    #[cfg(not(windows))]
    {
        Err("System tools are only supported on Windows.".to_string())
    }
}

pub fn launch_mas_activation() -> ToolResult<()> {
    #[cfg(windows)]
    {
        return run_mas_activation();
    }

    #[cfg(not(windows))]
    {
        Err("System tools are only supported on Windows.".to_string())
    }
}
