use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

use crate::types::StartupItem;

type StartupResult<T> = Result<T, String>;

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const DISABLED_SUFFIX: &str = ".pcl-disabled";
const DISABLED_STORE_FILE: &str = "disabled-startup-items.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DisabledRegistryEntry {
    id: String,
    name: String,
    command: String,
    registry_path: String,
    hive: String,
}

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn expand_env(value: &str) -> String {
    use windows_sys::Win32::System::Environment::ExpandEnvironmentStringsW;

    let input = to_wide(value);
    let mut buf: Vec<u16> = vec![0; 4096];
    let len = unsafe { ExpandEnvironmentStringsW(input.as_ptr(), buf.as_mut_ptr(), buf.len() as u32) };
    if len == 0 || len as usize > buf.len() {
        return value.to_string();
    }
    let end = buf.iter().position(|c| *c == 0).unwrap_or(len as usize);
    String::from_utf16_lossy(&buf[..end])
}

#[cfg(not(windows))]
fn expand_env(value: &str) -> String {
    value.to_string()
}

fn disabled_store_path(app: &AppHandle) -> StartupResult<PathBuf> {
    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push(DISABLED_STORE_FILE);
    Ok(dir)
}

fn read_disabled_registry_entries(app: &AppHandle) -> Vec<DisabledRegistryEntry> {
    let path = match disabled_store_path(app) {
        Ok(path) => path,
        Err(_) => return Vec::new(),
    };
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn write_disabled_registry_entries(app: &AppHandle, entries: &[DisabledRegistryEntry]) -> StartupResult<()> {
    let path = disabled_store_path(app)?;
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
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
fn reg_enum_values(key: windows_sys::Win32::System::Registry::HKEY) -> Vec<(String, String)> {
    use windows_sys::Win32::Foundation::ERROR_NO_MORE_ITEMS;
    use windows_sys::Win32::System::Registry::RegEnumValueW;

    let mut index: u32 = 0;
    let mut values = Vec::new();
    loop {
        let mut name_buf: [u16; 512] = [0; 512];
        let mut name_len: u32 = (name_buf.len() - 1) as u32;
        let mut value_type: u32 = 0;
        let mut data_buf: [u16; 2048] = [0; 2048];
        let mut data_len: u32 = (data_buf.len() * 2) as u32;
        let status = unsafe {
            RegEnumValueW(
                key,
                index,
                name_buf.as_mut_ptr(),
                &mut name_len,
                std::ptr::null_mut(),
                &mut value_type,
                data_buf.as_mut_ptr() as *mut u8,
                &mut data_len,
            )
        };
        if status == ERROR_NO_MORE_ITEMS {
            break;
        }
        if status != 0 {
            break;
        }
        let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        if let Some(command) = reg_query_string_value(key, &name) {
            values.push((name, command));
        }
        index += 1;
    }
    values
}

#[cfg(windows)]
fn open_registry_key(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
    access: u32,
) -> StartupResult<windows_sys::Win32::System::Registry::HKEY> {
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
fn set_registry_string_value(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
    name: &str,
    command: &str,
) -> StartupResult<()> {
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegSetValueExW, KEY_SET_VALUE, REG_SZ};

    let key = open_registry_key(hive, path, KEY_SET_VALUE)?;
    let name_w = to_wide(name);
    let data = to_wide(command);
    let data_len = (data.len() * 2) as u32;
    let status = unsafe {
        RegSetValueExW(
            key,
            name_w.as_ptr(),
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
    Ok(())
}

#[cfg(windows)]
fn delete_registry_value(
    hive: windows_sys::Win32::System::Registry::HKEY,
    path: &str,
    name: &str,
) -> StartupResult<()> {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegDeleteValueW, KEY_SET_VALUE};

    let key = open_registry_key(hive, path, KEY_SET_VALUE)?;
    let name_w = to_wide(name);
    let status = unsafe { RegDeleteValueW(key, name_w.as_ptr()) };
    unsafe {
        RegCloseKey(key);
    }
    if status == 0 || status == ERROR_FILE_NOT_FOUND {
        Ok(())
    } else {
        Err(format!("delete registry value failed: {status}"))
    }
}

#[cfg(windows)]
fn list_registry_items(hive_id: &str, writable: bool) -> StartupResult<Vec<StartupItem>> {
    use windows_sys::Win32::System::Registry::{RegCloseKey, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};

    let hive = match hive_id {
        "hkcu" => HKEY_CURRENT_USER,
        "hklm" => HKEY_LOCAL_MACHINE,
        _ => return Err("unsupported registry hive".to_string()),
    };
    let key = open_registry_key(hive, RUN_KEY, KEY_READ)?;
    let values = reg_enum_values(key);
    unsafe {
        RegCloseKey(key);
    }

    Ok(values
        .into_iter()
        .map(|(name, command)| StartupItem {
            id: format!("registry:{hive_id}:{RUN_KEY}:{name}"),
            name: name.clone(),
            command: expand_env(&command),
            source: format!("registry_{hive_id}"),
            enabled: true,
            writable,
        })
        .collect())
}

#[cfg(windows)]
fn user_startup_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|base| {
        PathBuf::from(base).join("Microsoft/Windows/Start Menu/Programs/Startup")
    })
}

#[cfg(windows)]
fn common_startup_dir() -> Option<PathBuf> {
    std::env::var_os("ProgramData").map(|base| {
        PathBuf::from(base).join("Microsoft/Windows/Start Menu/Programs/Startup")
    })
}

#[cfg(windows)]
fn startup_folder_display_name(path: &PathBuf) -> String {
    path.file_stem()
        .and_then(|name| name.to_str())
        .map(|name| {
            if name.ends_with(".lnk") {
                name.trim_end_matches(".lnk").to_string()
            } else {
                name.to_string()
            }
        })
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

#[cfg(windows)]
fn list_startup_folder_items(source: &str, dir: &PathBuf, writable: bool) -> StartupResult<Vec<StartupItem>> {
    let mut items = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(items),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        if file_name.starts_with('.') {
            continue;
        }

        let disabled = file_name.ends_with(DISABLED_SUFFIX);
        let active_name = if disabled {
            file_name.trim_end_matches(DISABLED_SUFFIX).to_string()
        } else {
            file_name.clone()
        };
        let active_path = dir.join(&active_name);
        let display_name = startup_folder_display_name(&PathBuf::from(&active_name));
        let id = format!("folder:{source}:{}", active_path.to_string_lossy());

        items.push(StartupItem {
            id,
            name: display_name,
            command: active_path.to_string_lossy().to_string(),
            source: format!("startup_{source}"),
            enabled: !disabled,
            writable,
        });
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[cfg(windows)]
fn list_disabled_registry_items(app: &AppHandle) -> Vec<StartupItem> {
    read_disabled_registry_entries(app)
        .into_iter()
        .map(|entry| StartupItem {
            id: entry.id,
            name: entry.name,
            command: expand_env(&entry.command),
            source: format!("registry_{}", entry.hive),
            enabled: false,
            writable: entry.hive == "hkcu",
        })
        .collect()
}

pub fn list_startup_items(app: &AppHandle) -> StartupResult<Vec<StartupItem>> {
    #[cfg(windows)]
    {
        let mut items = Vec::new();
        items.extend(list_registry_items("hkcu", true)?);
        items.extend(list_registry_items("hklm", false)?);
        if let Some(dir) = user_startup_dir() {
            items.extend(list_startup_folder_items("user", &dir, true)?);
        }
        if let Some(dir) = common_startup_dir() {
            items.extend(list_startup_folder_items("common", &dir, false)?);
        }
        items.extend(list_disabled_registry_items(app));

        items.sort_by(|a, b| {
            a.enabled
                .cmp(&b.enabled)
                .reverse()
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        return Ok(items);
    }

    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Startup item management is only supported on Windows.".to_string())
    }
}

#[cfg(windows)]
fn set_registry_item_enabled(app: &AppHandle, id: &str, enabled: bool) -> StartupResult<()> {
    use windows_sys::Win32::System::Registry::HKEY_CURRENT_USER;

    let prefix = format!("registry:hkcu:{RUN_KEY}:");
    if !id.starts_with(&prefix) {
        return Err("registry item is read-only".to_string());
    }
    let name = id.trim_start_matches(&prefix).to_string();
    let mut disabled_entries = read_disabled_registry_entries(app);

    if enabled {
        let entry = disabled_entries
            .iter()
            .find(|entry| entry.id == id)
            .cloned()
            .ok_or_else(|| "disabled registry entry not found".to_string())?;
        set_registry_string_value(HKEY_CURRENT_USER, RUN_KEY, &entry.name, &entry.command)?;
        disabled_entries.retain(|entry| entry.id != id);
        write_disabled_registry_entries(app, &disabled_entries)?;
        return Ok(());
    }

    let hive = HKEY_CURRENT_USER;
    let key = open_registry_key(hive, RUN_KEY, windows_sys::Win32::System::Registry::KEY_READ)?;
    let command = reg_query_string_value(key, &name)
        .ok_or_else(|| "registry value not found".to_string())?;
    unsafe {
        windows_sys::Win32::System::Registry::RegCloseKey(key);
    }

    delete_registry_value(HKEY_CURRENT_USER, RUN_KEY, &name)?;
    if !disabled_entries.iter().any(|entry| entry.id == id) {
        disabled_entries.push(DisabledRegistryEntry {
            id: id.to_string(),
            name: name.clone(),
            command,
            registry_path: RUN_KEY.to_string(),
            hive: "hkcu".to_string(),
        });
        write_disabled_registry_entries(app, &disabled_entries)?;
    }
    Ok(())
}

#[cfg(windows)]
fn set_folder_item_enabled(id: &str, enabled: bool) -> StartupResult<()> {
    let prefix = "folder:";
    if !id.starts_with(prefix) {
        return Err("invalid startup folder item id".to_string());
    }
    let path = id.trim_start_matches(prefix);
    let sep = path.find(':').ok_or_else(|| "invalid startup folder item id".to_string())?;
    let source = &path[..sep];
    if source == "common" {
        return Err("common startup folder requires administrator privileges".to_string());
    }
    let file_path = PathBuf::from(&path[sep + 1..]);
    let disabled_path = PathBuf::from(format!(
        "{}{}",
        file_path.to_string_lossy(),
        DISABLED_SUFFIX
    ));
    let (source_path, target_path) = if enabled {
        (disabled_path, file_path)
    } else {
        (file_path.clone(), disabled_path)
    };

    if !source_path.exists() {
        return Err("startup file not found".to_string());
    }

    fs::rename(&source_path, &target_path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_startup_item_enabled(app: &AppHandle, id: String, enabled: bool) -> StartupResult<()> {
    #[cfg(windows)]
    {
        if id.starts_with("registry:hkcu:") {
            return set_registry_item_enabled(app, &id, enabled);
        }
        if id.starts_with("folder:") {
            return set_folder_item_enabled(&id, enabled);
        }
        return Err("this startup item cannot be modified".to_string());
    }

    #[cfg(not(windows))]
    {
        let _ = (app, id, enabled);
        Err("Startup item management is only supported on Windows.".to_string())
    }
}
