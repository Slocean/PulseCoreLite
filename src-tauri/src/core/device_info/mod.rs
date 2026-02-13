use std::{
    collections::BTreeSet,
    process::Command,
};

use sysinfo::{Disks, System};

use crate::types::HardwareInfo;

pub fn collect_hardware_info() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().to_string())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let ram_spec = ram_details().unwrap_or_else(|| {
        let total_gb = (sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0)).max(1.0);
        format!("{total_gb:.0} GB")
    });

    let disk_models = disk_drive_models().unwrap_or_else(fallback_disk_models);

    HardwareInfo {
        cpu_model,
        cpu_max_freq_mhz: cpu_max_frequency(),
        gpu_model: gpu_models().unwrap_or_else(|| "N/A".to_string()),
        ram_spec,
        disk_models: if disk_models.is_empty() {
            vec!["Unknown disk".to_string()]
        } else {
            disk_models
        },
        motherboard: motherboard_name().unwrap_or_else(|| "Unknown motherboard".to_string()),
        device_brand: manufacturer_name().unwrap_or_else(|| "Unknown vendor".to_string()),
    }
}

fn ram_details() -> Option<String> {
    let script = r#"
$mem = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
if ($mem) {
    $total = ($mem | Measure-Object -Property Capacity -Sum).Sum
    $speed = ($mem | Measure-Object -Property Speed -Maximum).Maximum
    $type = ($mem | Select-Object -First 1 -ExpandProperty SMBIOSMemoryType)
    
    $typeStr = "DDR"
    switch ($type) {
        20 { $typeStr = "DDR" }
        21 { $typeStr = "DDR2" }
        24 { $typeStr = "DDR3" }
        26 { $typeStr = "DDR4" }
        30 { $typeStr = "DDR5" }
        34 { $typeStr = "LPDDR5" }
        default { $typeStr = "DDR" }
    }

    "{0} {1}MHz {2}G" -f $typeStr, $speed, [math]::Round($total / 1GB)
}
"#;
    run_powershell_lines(script)
        .and_then(|lines| lines.first().map(|s| s.trim().to_string()))
}

fn fallback_disk_models() -> Vec<String> {
    let disks = Disks::new_with_refreshed_list();
    let mut list = Vec::new();
    let mut dedup = BTreeSet::new();

    for disk in disks.list() {
        let mount = disk.mount_point().to_string_lossy().to_string();
        let name = disk.name().to_string_lossy().to_string();
        let item = format!("{} · {}", mount, name);
        if dedup.insert(item.clone()) {
            list.push(item);
        }
    }

    list
}

fn cpu_max_frequency() -> Option<u64> {
    let script = r#"
$freq = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -ExpandProperty MaxClockSpeed
if ($freq) { $freq }
"#;
    run_powershell_lines(script)
        .and_then(|lines| lines.first().and_then(|s| s.parse().ok()))
}

fn gpu_models() -> Option<String> {
    let script = r#"
$items = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty Name
$items | Where-Object { $_ -and $_.Trim().Length -gt 0 } | ForEach-Object { $_.Trim() }
"#;

    let mut names = run_powershell_lines(script)?;
    names.retain(|name| !name.is_empty());
    names.sort();
    names.dedup();

    if names.is_empty() {
        return first_wmic_value(&["path", "win32_VideoController", "get", "Name", "/value"]);
    }

    Some(names.join(" / "))
}

fn disk_drive_models() -> Option<Vec<String>> {
    let script = r#"
$rows = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object {
  $logicalDisk = $_
  $partitions = Get-CimAssociatedInstance -InputObject $logicalDisk -Association Win32_LogicalDiskToPartition -ErrorAction SilentlyContinue
  foreach ($partition in $partitions) {
    $drives = Get-CimAssociatedInstance -InputObject $partition -Association Win32_DiskDriveToDiskPartition -ErrorAction SilentlyContinue
    foreach ($drive in $drives) {
      "{0}|{1}" -f $logicalDisk.DeviceID, $drive.Model
    }
  }
}
$rows | Sort-Object -Unique
"#;

    let lines = run_powershell_lines(script)?;
    let mut list = Vec::new();
    let mut dedup = BTreeSet::new();

    for line in lines {
        if let Some((drive, model)) = line.split_once('|') {
            let drive = drive.trim();
            let model = model.trim();
            if !drive.is_empty() && !model.is_empty() {
                let item = format!("{} · {}", drive, model);
                if dedup.insert(item.clone()) {
                    list.push(item);
                }
            }
        }
    }

    if list.is_empty() {
        None
    } else {
        Some(list)
    }
}

fn motherboard_name() -> Option<String> {
    let script = r#"
(Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty Product)
"#;

    run_powershell_lines(script)
        .and_then(|mut rows| rows.drain(..).find(|row| !row.trim().is_empty()))
        .or_else(|| first_wmic_value(&["baseboard", "get", "product", "/value"]))
}

fn manufacturer_name() -> Option<String> {
    let script = r#"
(Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty Manufacturer)
"#;

    run_powershell_lines(script)
        .and_then(|mut rows| rows.drain(..).find(|row| !row.trim().is_empty()))
        .or_else(|| first_wmic_value(&["computersystem", "get", "manufacturer", "/value"]))
}

fn run_powershell_lines(script: &str) -> Option<Vec<String>> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", script])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let lines = text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();

        if lines.is_empty() {
            None
        } else {
            Some(lines)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = script;
        None
    }
}

fn first_wmic_value(args: &[&str]) -> Option<String> {
    let raw = run_wmic(args)?;
    for line in raw.lines() {
        if let Some((_k, v)) = line.split_once('=') {
            let text = v.trim();
            if !text.is_empty() {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn run_wmic(args: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wmic").args(args).output().ok()?;
        if !output.status.success() {
            return None;
        }
        return Some(String::from_utf8_lossy(&output.stdout).to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = args;
        None
    }
}
